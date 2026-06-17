export type StoryPlaybackPhase = 'timer' | 'narration' | 'media' | null;

export type StoryPlaybackState = {
  currentTime: number;
  duration: number;
  playState: 'playing' | 'paused' | 'idle';
  isBuffering: boolean;
  phase: StoryPlaybackPhase;
};

type PlaybackClockDeps = {
  now?: () => number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  tickMs?: number;
};

type TimerPhaseConfig = {
  kind: 'timer';
  offsetSec?: number;
  durationSec: number;
  onComplete?: () => void;
};

type ExternalPhaseConfig = {
  kind: 'narration' | 'media';
  offsetSec?: number;
  durationSec: number;
  sourceStartSec: number;
  getCurrentTime: () => number | null | undefined;
  onComplete?: () => void;
};

type PhaseConfig = TimerPhaseConfig | ExternalPhaseConfig;

type StateListener = (state: StoryPlaybackState) => void;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toFiniteNonNegative = (value: number | null | undefined): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Number(value));
};

export class StoryPlaybackClock {
  state = $state<StoryPlaybackState>({
    currentTime: 0,
    duration: 0,
    playState: 'idle',
    isBuffering: false,
    phase: null,
  });

  private readonly now: () => number;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly tickMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private phase: PhaseConfig | null = null;
  private phaseStartedAtMs = 0;
  private phaseElapsedAtStartSec = 0;
  private listeners = new Set<StateListener>();

  constructor(deps: PlaybackClockDeps = {}) {
    this.now = deps.now ?? (() => Date.now());
    this.setIntervalFn = deps.setIntervalFn ?? setInterval;
    this.clearIntervalFn = deps.clearIntervalFn ?? clearInterval;
    this.tickMs = Math.max(16, deps.tickMs ?? 50);
  }

  getState(): StoryPlaybackState {
    return {
      currentTime: this.state.currentTime,
      duration: this.state.duration,
      playState: this.state.playState,
      isBuffering: this.state.isBuffering,
      phase: this.state.phase,
    };
  }

  subscribe(listener: StateListener): () => void {
    listener(this.getState());
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
  }

  loadChapter(durationSec: number): void {
    const normalized = toFiniteNonNegative(durationSec);
    this.stopTickLoop();
    this.phase = null;
    this.phaseStartedAtMs = 0;
    this.phaseElapsedAtStartSec = 0;
    this.applyState({
      currentTime: 0,
      duration: normalized,
      playState: 'idle',
      phase: null,
    });
  }

  setBuffering(isBuffering: boolean): void {
    this.applyState({ isBuffering });
  }

  startTimerPhase(config: Omit<TimerPhaseConfig, 'kind'>): void {
    this.setPhase({
      kind: 'timer',
      durationSec: toFiniteNonNegative(config.durationSec),
      offsetSec: toFiniteNonNegative(config.offsetSec),
      onComplete: config.onComplete,
    });
  }

  startNarrationPhase(config: Omit<ExternalPhaseConfig, 'kind'>): void {
    this.setPhase({
      ...config,
      kind: 'narration',
      durationSec: toFiniteNonNegative(config.durationSec),
      offsetSec: toFiniteNonNegative(config.offsetSec),
      sourceStartSec: Number.isFinite(config.sourceStartSec)
        ? Number(config.sourceStartSec)
        : 0,
    });
  }

  startMediaPhase(config: Omit<ExternalPhaseConfig, 'kind'>): void {
    this.setPhase({
      ...config,
      kind: 'media',
      durationSec: toFiniteNonNegative(config.durationSec),
      offsetSec: toFiniteNonNegative(config.offsetSec),
      sourceStartSec: Number.isFinite(config.sourceStartSec)
        ? Number(config.sourceStartSec)
        : 0,
    });
  }

  play(): void {
    if (this.state.playState === 'playing') return;

    if (!this.phase) {
      this.applyState({ playState: 'playing' });
      return;
    }

    this.phaseStartedAtMs = this.now();
    this.applyState({ playState: 'playing' });
    this.tick();
    if (this.getState().playState === 'playing') {
      this.startTickLoop();
    }
  }

  pause(): void {
    if (this.state.playState !== 'playing') return;
    if (this.phase) {
      this.phaseElapsedAtStartSec = this.computePhaseElapsedSec(this.phase);
    }
    this.stopTickLoop();
    this.applyState({ playState: 'paused' });
  }

  stop(): void {
    this.stopTickLoop();
    this.phase = null;
    this.phaseStartedAtMs = 0;
    this.phaseElapsedAtStartSec = 0;
    this.applyState({ currentTime: 0, playState: 'idle', phase: null });
  }

  private setPhase(phase: PhaseConfig): void {
    this.stopTickLoop();
    this.phase = phase;
    this.phaseElapsedAtStartSec = 0;
    this.phaseStartedAtMs = this.now();

    const offsetSec = toFiniteNonNegative(phase.offsetSec);
    const durationSec = toFiniteNonNegative(phase.durationSec);
    const requiredDuration = offsetSec + durationSec;

    this.applyState({
      duration: Math.max(this.state.duration, requiredDuration),
      currentTime: clamp(offsetSec, 0, Math.max(this.state.duration, requiredDuration)),
      phase: phase.kind,
    });

    if (this.state.playState === 'playing') {
      this.tick();
      if (this.state.playState === 'playing') {
        this.startTickLoop();
      }
    }
  }

  private startTickLoop(): void {
    this.stopTickLoop();
    this.timerId = Reflect.apply(
      this.setIntervalFn as unknown as (...args: unknown[]) => ReturnType<typeof setInterval>,
      globalThis,
      [() => this.tick(), this.tickMs],
    );
  }

  private stopTickLoop(): void {
    if (!this.timerId) return;
    Reflect.apply(
      this.clearIntervalFn as unknown as (...args: unknown[]) => void,
      globalThis,
      [this.timerId],
    );
    this.timerId = null;
  }

  private tick(): void {
    const phase = this.phase;
    if (!phase || this.state.playState !== 'playing' || this.state.isBuffering) return;

    const phaseDurationSec = toFiniteNonNegative(phase.durationSec);
    const offsetSec = toFiniteNonNegative(phase.offsetSec);
    const elapsedSec = clamp(this.computePhaseElapsedSec(phase), 0, phaseDurationSec);

    const absoluteTime = clamp(offsetSec + elapsedSec, 0, this.state.duration);
    this.applyState({ currentTime: absoluteTime });

    const elapsedMs = Math.round(elapsedSec * 1000);
    const durationMs = Math.round(phaseDurationSec * 1000);

    if (elapsedMs >= durationMs) {
      const onComplete = phase.onComplete;
      this.phase = null;
      this.phaseStartedAtMs = 0;
      this.phaseElapsedAtStartSec = 0;
      this.stopTickLoop();
      this.applyState({ playState: 'idle', phase: null });
      onComplete?.();
    }
  }

  private computePhaseElapsedSec(phase: PhaseConfig): number {
    if (phase.kind === 'timer') {
      const elapsedWallClockSec = Math.max(0, (this.now() - this.phaseStartedAtMs) / 1000);
      return this.phaseElapsedAtStartSec + elapsedWallClockSec;
    }

    const rawTime = phase.getCurrentTime();
    if (Number.isFinite(rawTime)) {
      return Math.max(0, Number(rawTime) - phase.sourceStartSec);
    }

    const elapsedWallClockSec = Math.max(0, (this.now() - this.phaseStartedAtMs) / 1000);
    return this.phaseElapsedAtStartSec + elapsedWallClockSec;
  }

  private applyState(patch: Partial<StoryPlaybackState>): void {
    let changed = false;

    if (patch.currentTime !== undefined && this.state.currentTime !== patch.currentTime) {
      this.state.currentTime = patch.currentTime;
      changed = true;
    }
    if (patch.duration !== undefined && this.state.duration !== patch.duration) {
      this.state.duration = patch.duration;
      changed = true;
    }
    if (patch.playState !== undefined && this.state.playState !== patch.playState) {
      this.state.playState = patch.playState;
      changed = true;
    }
    if (patch.isBuffering !== undefined && this.state.isBuffering !== patch.isBuffering) {
      this.state.isBuffering = patch.isBuffering;
      changed = true;
    }
    if (patch.phase !== undefined && this.state.phase !== patch.phase) {
      this.state.phase = patch.phase;
      changed = true;
    }

    if (!changed) return;

    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      listener(snapshot);
    });
  }
}

export const createStoryPlaybackClock = (
  deps: PlaybackClockDeps = {},
): StoryPlaybackClock => new StoryPlaybackClock(deps);
