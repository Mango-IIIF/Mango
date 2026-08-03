import { writable, type Writable } from 'svelte/store';
import type { ViewerApi } from '../../core/types/viewer-api';
import type { StoryWithDefaults } from './storyLoader';
import { resolveChapterTiming } from '../timing';
import { sampleCameraTrack } from '../cameraTrack';
import { createNarrationPlayer, type NarrationPlayer } from '../narrationPlayer';
import type { NarrationSegment as PlayerSegment } from '../narrationPlayer';
import {
  createStoryPlaybackClock,
  type StoryPlaybackClock,
  type StoryPlaybackState,
} from '../playbackClock.svelte';
import {
  createChapterTransitionOrchestrator,
  type ChapterTransitionOrchestrator,
  type TransitionEventMap,
} from './chapterTransitionOrchestrator';

export type StoryViewerRuntimeState =
  | 'IDLE'
  | 'LOADING_CHAPTER'
  | 'PLAYING_NARRATION'
  | 'PLAYING_MEDIA'
  | 'PRESENTING_SILENT'
  | 'TRANSITION_DELAY'
  | 'PAUSED'
  | 'ENDED';

type RuntimeDeps = {
  language?: string;
  createNarrationPlayer?: () => NarrationPlayer;
  createPlaybackClock?: () => StoryPlaybackClock;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  prefersReducedMotion?: boolean;
  posePaintedTimeoutMs?: number;
  sourceOpenTimeoutMs?: number;
  onTransitionEvent?: <K extends keyof TransitionEventMap>(
    event: K,
    payload: TransitionEventMap[K]
  ) => void;
};

export type StoryViewerRuntime = {
  loadStory: (story: StoryWithDefaults) => Promise<void>;
  loadChapter: (index: number, options?: { autoPlay?: boolean }) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  destroy: () => void;
  getState: () => StoryViewerRuntimeState;
  currentChapterIndex: Writable<number>;
  isLoading: Writable<boolean>;
  playState: Writable<'idle' | 'playing' | 'paused'>;
  playbackState: Writable<StoryPlaybackState>;
  getStory: () => StoryWithDefaults | null;
};

const toNarrationSegment = (
  story: StoryWithDefaults | null,
  chapterIndex: number,
  language: string,
): PlayerSegment | null => {
  if (!story?.chapters?.[chapterIndex]) return null;
  const chapter = story.chapters[chapterIndex];
  const segment = chapter.narrationSegment?.[language];
  const src = story.narration?.tracks?.[language]?.src;
  if (!segment || !src) return null;
  if (segment.end <= segment.start) return null;
  return { src, start: segment.start, end: segment.end };
};

const toChapterDurationSec = (
  chapter: StoryWithDefaults['chapters'][number] | undefined,
  language: string,
): number => {
  if (!chapter) return 0;

  const narrationMap = chapter.narrationSegment ?? {};
  const narrationSegment =
    narrationMap[language] ??
    (Object.keys(narrationMap).length > 0
      ? narrationMap[Object.keys(narrationMap)[0]]
      : undefined);
  const narrationDuration =
    narrationSegment &&
    Number.isFinite(narrationSegment.start) &&
    Number.isFinite(narrationSegment.end)
      ? Math.max(0, narrationSegment.end - narrationSegment.start)
      : 0;

  const mediaDuration =
    chapter.media &&
    Number.isFinite(chapter.media.start) &&
    Number.isFinite(chapter.media.end)
      ? Math.max(0, chapter.media.end - chapter.media.start)
      : 0;

  return Math.max(
    narrationDuration + mediaDuration,
    (chapter.cameraTrack?.durationMs ?? 0) / 1000,
    resolveChapterTiming(chapter).presentationDurationMs / 1000,
  );
};

export const createStoryViewerRuntime = (
  viewer: ViewerApi,
  deps: RuntimeDeps = {},
): StoryViewerRuntime => {
  let story: StoryWithDefaults | null = null;
  let orchestrator: ChapterTransitionOrchestrator | null = null;
  let state: StoryViewerRuntimeState = 'IDLE';
  const currentChapterIndex = writable(0);
  const isLoading = writable(false);
  const playState = writable<'idle' | 'playing' | 'paused'>('idle');
  const playbackState = writable<StoryPlaybackState>({
    currentTime: 0,
    duration: 0,
    playState: 'idle',
    isBuffering: false,
    phase: null,
  });
  let chapterIndexValue = 0;
  /**
   * Chapter whose camera track the playback clock currently represents, or
   * null while a chapter transition is in flight.
   *
   * The clock is reset at the start of a transition, long before the incoming
   * chapter is ready. Sampling on that reset used to read the *outgoing*
   * chapter's track at t=0, snapping the camera back to where that chapter
   * opened before the pan to the new chapter began — read as the viewer
   * resetting itself. Holding the camera still until the incoming chapter is
   * loaded leaves the transition pan to the orchestrator, which owns it.
   */
  let cameraChapterIndex: number | null = null;
  /** Identifies the most recent chapter load, so superseded ones stand down. */
  let chapterLoadToken = 0;

  const now = deps.now ?? (() => Date.now());
  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
  const requestAnimationFrameFn =
    deps.requestAnimationFrame ??
    ((callback: FrameRequestCallback) =>
      setTimeoutFn(() => callback(now()), 16) as unknown as number);
  const cancelAnimationFrameFn =
    deps.cancelAnimationFrame ??
    ((handle: number) => {
      clearTimeoutFn(handle as unknown as ReturnType<typeof setTimeout>);
    });
  const onTransitionEvent = deps.onTransitionEvent;

  const playbackClock =
    deps.createPlaybackClock?.() ??
    createStoryPlaybackClock({
      now,
      setIntervalFn: deps.setIntervalFn,
      clearIntervalFn: deps.clearIntervalFn,
    });
  type MangoStoryGlobals = typeof globalThis & {
    __MangoStoryNarrationPlayer?: () => ReturnType<typeof createNarrationPlayer>;
    __calls?: Record<string, number>;
  };
  const globals = globalThis as MangoStoryGlobals;
  const globalNarrationFactory = globals.__MangoStoryNarrationPlayer;
  const narrationPlayer =
    deps.createNarrationPlayer?.() ??
    (typeof globalNarrationFactory === 'function'
      ? globalNarrationFactory()
      : createNarrationPlayer({
          onBufferingChange: (isBuffering) => playbackClock.setBuffering(isBuffering),
        }));
  const prefersReducedMotion =
    deps.prefersReducedMotion ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);

  // Applies the camera track for the active chapter at a given presentation
  // time. With reduced motion we jump straight to the final framing and hold.
  const applyCameraSample = (currentTimeSec: number) => {
    if (cameraChapterIndex === null) return;
    const chapter = story?.chapters?.[cameraChapterIndex];
    if (!chapter?.cameraTrack) return;
    const timeMs = prefersReducedMotion
      ? chapter.cameraTrack.durationMs
      : currentTimeSec * 1000;
    const sample = sampleCameraTrack(chapter.cameraTrack, timeMs);
    if (!sample) return;
    if (sample.viewBox) viewer.setViewBox?.(sample.viewBox);
    if (sample.model) viewer.setModelPose?.(sample.model);
    if (sample.layerOpacities) {
      for (const [id, opacity] of Object.entries(sample.layerOpacities)) {
        viewer.updateLayerOpacity?.(id, opacity);
      }
    }
  };

  // During playback the camera is driven by requestAnimationFrame (display
  // refresh rate, ~60fps) rather than the 20fps clock tick, using a wall-clock
  // derived time so motion is smooth. The clock still owns phase/timing.
  let cameraFrameHandle: number | null = null;
  const stopCameraLoop = () => {
    if (cameraFrameHandle == null) return;
    cancelAnimationFrameFn(cameraFrameHandle);
    cameraFrameHandle = null;
  };
  const cameraLoop = () => {
    cameraFrameHandle = null;
    const value = playbackClock.getState();
    if (value.playState !== 'playing') return;
    if (!value.isBuffering) {
      const liveTime =
        typeof playbackClock.getLiveCurrentTime === 'function'
          ? playbackClock.getLiveCurrentTime()
          : value.currentTime;
      applyCameraSample(liveTime);
    }
    cameraFrameHandle = requestAnimationFrameFn(cameraLoop);
  };
  const startCameraLoop = () => {
    if (cameraFrameHandle == null) cameraFrameHandle = requestAnimationFrameFn(cameraLoop);
  };

  const unsubscribeClock = playbackClock.subscribe((value) => {
    playbackState.set(value);
    if (value.playState === 'playing' && !value.isBuffering && !prefersReducedMotion) {
      // Hand ongoing motion to the animation-frame loop.
      startCameraLoop();
    } else {
      // Idle / paused / buffering / reduced-motion: apply a single frame so the
      // camera reflects the current time (chapter load, scrub, pause) and hold.
      stopCameraLoop();
      applyCameraSample(value.currentTime);
    }
  });

  let activeLanguage = deps.language ?? 'en';
  let mediaPlaying = false;
  let pausedKind: 'narration' | 'media' | 'timer' | null = null;
  let activeTimerKind: 'presentation' | 'transition' | null = null;
  let lastMediaTimeSec = 0;
  let orchestratorUnsubscribers: Array<() => void> = [];

  const bumpCall = (name: string) => {
    if (typeof window === 'undefined') return;
    const calls = globals.__calls;
    if (!calls) return;
    calls[name] = (calls[name] ?? 0) + 1;
  };

  const getState = () => state;
  const getStory = () => story;

  const setState = (next: StoryViewerRuntimeState) => {
    state = next;
    if (
      next === 'PLAYING_NARRATION' ||
      next === 'PLAYING_MEDIA' ||
      next === 'PRESENTING_SILENT' ||
      next === 'TRANSITION_DELAY'
    ) {
      playState.set('playing');
    } else if (next === 'PAUSED') {
      playState.set('paused');
    } else {
      playState.set('idle');
    }
  };

  const clearOrchestratorListeners = () => {
    for (const unsubscribe of orchestratorUnsubscribers) {
      unsubscribe();
    }
    orchestratorUnsubscribers = [];
  };

  const resetPlaybackForChapter = (chapterIdx: number) => {
    const chapter = story?.chapters?.[chapterIdx];
    const durationSec = toChapterDurationSec(chapter, activeLanguage);
    cameraChapterIndex = chapterIdx;
    playbackClock.loadChapter(durationSec);
    playbackClock.setBuffering(false);
    activeTimerKind = null;
  };

  const completeStory = () => {
    currentChapterIndex.set(0);
    chapterIndexValue = 0;
    void loadChapter(0);
    setState('ENDED');
  };

  const advanceToNextChapter = (autoPlay = true) => {
    const nextIndex = chapterIndexValue + 1;
    if (story && story.chapters && nextIndex < story.chapters.length) {
      bumpCall('setCanvasByIndex');
      void loadChapter(nextIndex, { autoPlay });
      return;
    }
    completeStory();
  };

  const startTransitionDelay = () => {
    const chapter = story?.chapters?.[chapterIndexValue];
    if (!chapter) return;

    if (chapter.advance?.mode === 'manual') {
      playbackClock.stop();
      setState('IDLE');
      return;
    }

    setState('TRANSITION_DELAY');
    pausedKind = null;
    activeTimerKind = 'transition';

    const nextIndex = chapterIndexValue + 1;
    if (story && story.chapters && nextIndex < story.chapters.length) {
      bumpCall('setCanvasByIndex');
    }

    const timing = resolveChapterTiming(chapter);
    const legacyDelayMs = timing.migratedFromLegacy ? timing.presentationDurationMs : 0;
    playbackClock.startTimerPhase({
      offsetSec: playbackClock.getState().duration,
      durationSec: (timing.advanceDelayMs ?? legacyDelayMs) / 1000,
      onComplete: () => {
        advanceToNextChapter(true);
      },
    });
    playbackClock.play();
  };

  const finishChapterPresentation = (completedContentSec: number) => {
    const chapter = story?.chapters?.[chapterIndexValue];
    if (!chapter) return;
    const remainingSec = Math.max(
      0,
      toChapterDurationSec(chapter, activeLanguage) - Math.max(0, completedContentSec),
    );
    if (remainingSec <= 0.001) {
      startTransitionDelay();
      return;
    }

    setState('PRESENTING_SILENT');
    pausedKind = null;
    activeTimerKind = 'presentation';
    playbackClock.startTimerPhase({
      offsetSec: Math.max(0, completedContentSec),
      durationSec: remainingSec,
      onComplete: startTransitionDelay,
    });
    playbackClock.play();
  };

  const playMedia = (offsetSec = 0) => {
    const chapter = story?.chapters?.[chapterIndexValue];
    if (!chapter?.media) return false;

    const { start, end } = chapter.media;
    const mediaDurationSec = Math.max(0, end - start);

    setState('PLAYING_MEDIA');
    pausedKind = null;
    activeTimerKind = null;

    lastMediaTimeSec = start;
    viewer.setMediaSegment?.(start, end);
    viewer.play?.();
    mediaPlaying = true;

    playbackClock.startMediaPhase({
      offsetSec,
      durationSec: mediaDurationSec,
      sourceStartSec: start,
      getCurrentTime: () => lastMediaTimeSec,
      onComplete: () => {
        if (state !== 'PLAYING_MEDIA' || !mediaPlaying) return;
        mediaPlaying = false;
        viewer.pause?.();
        finishChapterPresentation(offsetSec + mediaDurationSec);
      },
    });
    playbackClock.play();

    return true;
  };

  const playNarration = () => {
    const chapter = story?.chapters?.[chapterIndexValue];
    const chapterId = chapter?.id;
    const segment = toNarrationSegment(story, chapterIndexValue, activeLanguage);
    if (!segment || !chapterId) return false;

    const narrationDurationSec = Math.max(0, segment.end - segment.start);

    setState('PLAYING_NARRATION');
    pausedKind = null;
    activeTimerKind = null;

    playbackClock.startNarrationPhase({
      offsetSec: 0,
      durationSec: narrationDurationSec,
      sourceStartSec: segment.start,
      getCurrentTime: () => narrationPlayer.getCurrentTime?.() ?? null,
    });
    playbackClock.play();

    narrationPlayer
      .playSegment(segment)
      .then((ok: boolean) => {
        const currentChapterId = story?.chapters?.[chapterIndexValue]?.id;
        if (currentChapterId !== chapterId) return;

        if (!ok) {
          playbackClock.stop();
          setState('IDLE');
          return;
        }

        const nextChapter = story?.chapters?.[chapterIndexValue];
        if (nextChapter?.media) {
          playMedia(narrationDurationSec);
        } else {
          finishChapterPresentation(narrationDurationSec);
        }
      })
      .catch(() => {
        const currentChapterId = story?.chapters?.[chapterIndexValue]?.id;
        if (currentChapterId !== chapterId) return;
        playbackClock.stop();
        setState('IDLE');
      });

    return true;
  };

  const isSilentChapter = (index: number): boolean => {
    if (!story || !story.chapters?.[index]) return false;
    const chapter = story.chapters[index];
    const hasView = Boolean(chapter.viewBox || chapter.model);
    const hasMedia = Boolean(chapter.media);
    const hasNarration = Boolean(
      chapter.narrationSegment && Object.keys(chapter.narrationSegment).length > 0,
    );
    return hasView && !hasMedia && !hasNarration;
  };

  const startSilentPresentation = () => {
    const chapter = story?.chapters?.[chapterIndexValue];
    if (!chapter) return;

    setState('PRESENTING_SILENT');
    pausedKind = null;
    activeTimerKind = 'presentation';

    playbackClock.startTimerPhase({
      offsetSec: 0,
      durationSec: toChapterDurationSec(chapter, activeLanguage),
      onComplete: startTransitionDelay,
    });
    playbackClock.play();
  };

  const loadChapter = async (
    index: number,
    options: { autoPlay?: boolean } = {},
  ): Promise<void> => {
    if (!story || !Array.isArray(story.chapters)) return;
    const chapter = story.chapters[index];
    if (!chapter) return;

    // Claim this load. A transition that gets superseded still settles its
    // gates so nothing leaks, which means its continuation below can run
    // after a newer chapter has already taken over — this token is what
    // stops it applying the wrong chapter's state on top.
    const token = ++chapterLoadToken;

    // Detach the camera from the clock before it is reset, so the outgoing
    // chapter's track is not sampled while the incoming chapter loads.
    cameraChapterIndex = null;
    narrationPlayer.stop();
    playbackClock.stop();
    playbackClock.setBuffering(true);
    viewer.pause?.();
    mediaPlaying = false;
    lastMediaTimeSec = 0;
    pausedKind = null;
    activeTimerKind = null;

    setState('LOADING_CHAPTER');
    isLoading.set(true);

    if (!orchestrator) {
      setState('IDLE');
      isLoading.set(false);
      playbackClock.setBuffering(false);
      return;
    }

    try {
      await orchestrator.loadChapter(index, options);
      if (token !== chapterLoadToken) return;
      currentChapterIndex.set(index);
      chapterIndexValue = index;
      resetPlaybackForChapter(index);
      setState('IDLE');
      isLoading.set(false);

      if (options.autoPlay) {
        bumpCall('play');
        play();
      }
    } catch (error) {
      if (token !== chapterLoadToken) return;
      console.error('[StoryViewer] Chapter load error:', error);
      setState('IDLE');
      isLoading.set(false);
      playbackClock.setBuffering(false);
    }
  };

  const loadStory = async (value: StoryWithDefaults): Promise<void> => {
    story = value;

    // Destroying the orchestrator settles any in-flight gate, releasing a
    // chapter load that belongs to the story being replaced.
    chapterLoadToken += 1;
    clearOrchestratorListeners();
    if (orchestrator) {
      orchestrator.destroy();
      orchestrator = null;
    }

    orchestrator = createChapterTransitionOrchestrator(viewer, story, {
      now,
      setTimeoutFn,
      clearTimeoutFn,
      requestAnimationFrame: requestAnimationFrameFn,
      cancelAnimationFrame: cancelAnimationFrameFn,
      posePaintedTimeoutMs: deps.posePaintedTimeoutMs,
      sourceOpenTimeoutMs: deps.sourceOpenTimeoutMs,
    });

    if (onTransitionEvent) {
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:start', (payload) => {
          playbackClock.setBuffering(true);
          onTransitionEvent('transition:start', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:assetsLoading', (payload) => {
          playbackClock.setBuffering(true);
          onTransitionEvent('transition:assetsLoading', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:sourceOpen', (payload) => {
          playbackClock.setBuffering(true);
          onTransitionEvent('transition:sourceOpen', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:poseApplied', (payload) => {
          onTransitionEvent('transition:poseApplied', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:posePainted', (payload) => {
          onTransitionEvent('transition:posePainted', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:narrationStarted', (payload) => {
          onTransitionEvent('transition:narrationStarted', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:mediaStarted', (payload) => {
          onTransitionEvent('transition:mediaStarted', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:ready', (payload) => {
          playbackClock.setBuffering(false);
          onTransitionEvent('transition:ready', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:cancelled', (payload) => {
          playbackClock.setBuffering(false);
          onTransitionEvent('transition:cancelled', payload);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:error', (payload) => {
          playbackClock.setBuffering(false);
          onTransitionEvent('transition:error', payload);
        }),
      );
    } else {
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:start', () => {
          playbackClock.setBuffering(true);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:assetsLoading', () => {
          playbackClock.setBuffering(true);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:sourceOpen', () => {
          playbackClock.setBuffering(true);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:ready', () => {
          playbackClock.setBuffering(false);
        }),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:cancelled', () => playbackClock.setBuffering(false)),
      );
      orchestratorUnsubscribers.push(
        orchestrator.on('transition:error', () => playbackClock.setBuffering(false)),
      );
    }

    const trackLangs = Object.keys(story.narration?.tracks ?? {});
    const segmentLangs = story.chapters[0]?.narrationSegment
      ? Object.keys(story.chapters[0].narrationSegment ?? {})
      : [];

    if (!trackLangs.includes(activeLanguage) && trackLangs.length > 0) {
      activeLanguage = trackLangs.includes('en') ? 'en' : trackLangs[0];
    } else if (trackLangs.length === 0 && segmentLangs.length > 0) {
      activeLanguage = segmentLangs.includes('en') ? 'en' : segmentLangs[0];
    }

    if (!story.chapters || story.chapters.length === 0) {
      playbackClock.loadChapter(0);
      playbackClock.setBuffering(false);
      return;
    }

    await loadChapter(0);
  };

  const play = () => {
    bumpCall('setCanvasByIndex');
    bumpCall('play');

    if (!story) return;

    if (state === 'ENDED') {
      currentChapterIndex.set(0);
      chapterIndexValue = 0;
      void loadChapter(0, { autoPlay: true });
      return;
    }

    if (state === 'PAUSED' && pausedKind === 'narration') {
      if (narrationPlayer.resume()) {
        playbackClock.play();
        setState('PLAYING_NARRATION');
        pausedKind = null;
        return;
      }
    }

    if (state === 'PAUSED' && pausedKind === 'media') {
      viewer.play?.();
      mediaPlaying = true;
      playbackClock.play();
      setState('PLAYING_MEDIA');
      pausedKind = null;
      return;
    }

    if (state === 'PAUSED' && pausedKind === 'timer') {
      playbackClock.play();
      setState(activeTimerKind === 'presentation' ? 'PRESENTING_SILENT' : 'TRANSITION_DELAY');
      pausedKind = null;
      return;
    }

    if (isSilentChapter(chapterIndexValue)) {
      startSilentPresentation();
      return;
    }

    const playedNarration = playNarration();
    if (playedNarration) return;

    const chapter = story?.chapters?.[chapterIndexValue];
    if (chapter?.media) {
      playMedia(0);
      return;
    }

    startTransitionDelay();
  };

  const pause = () => {
    if (state === 'PLAYING_MEDIA' && mediaPlaying) {
      viewer.pause?.();
      mediaPlaying = false;
      playbackClock.pause();
      pausedKind = 'media';
      setState('PAUSED');
      return;
    }

    if (state === 'PLAYING_NARRATION' && narrationPlayer.pause()) {
      playbackClock.pause();
      pausedKind = 'narration';
      setState('PAUSED');
      return;
    }

    if (state === 'PRESENTING_SILENT' || state === 'TRANSITION_DELAY') {
      playbackClock.pause();
      pausedKind = 'timer';
      setState('PAUSED');
    }
  };

  const stop = () => {
    // Same reasoning as loadChapter: the clock reset below must not repaint
    // the camera from the chapter we are leaving.
    cameraChapterIndex = null;
    narrationPlayer.stop();
    playbackClock.stop();
    playbackClock.setBuffering(false);

    if (mediaPlaying) {
      viewer.pause?.();
      mediaPlaying = false;
    }

    lastMediaTimeSec = 0;
    pausedKind = null;
    activeTimerKind = null;
    setState('IDLE');

    if (story && story.chapters?.length) {
      currentChapterIndex.set(0);
      chapterIndexValue = 0;
      void loadChapter(0);
    }
  };

  const handleMediaTimeUpdate = (payload: { time: number }) => {
    if (!Number.isFinite(payload.time)) return;
    lastMediaTimeSec = payload.time;
  };

  const handleMediaSegmentEnd = () => {
    if (state !== 'PLAYING_MEDIA' || !mediaPlaying) return;
    mediaPlaying = false;
    viewer.pause?.();
    const chapter = story?.chapters?.[chapterIndexValue];
    const narration = toNarrationSegment(story, chapterIndexValue, activeLanguage);
    const narrationDurationSec = narration ? Math.max(0, narration.end - narration.start) : 0;
    const mediaDurationSec = chapter?.media
      ? Math.max(0, chapter.media.end - chapter.media.start)
      : 0;
    finishChapterPresentation(narrationDurationSec + mediaDurationSec);
  };

  const unsubscribeMediaSegmentEnd = viewer.on?.('mediaSegmentEnd', handleMediaSegmentEnd);
  const unsubscribeMediaTimeUpdate = viewer.on?.('mediaTimeUpdate', handleMediaTimeUpdate);

  const destroy = () => {
    chapterLoadToken += 1;
    if (unsubscribeMediaSegmentEnd) {
      unsubscribeMediaSegmentEnd();
    }
    if (unsubscribeMediaTimeUpdate) {
      unsubscribeMediaTimeUpdate();
    }

    clearOrchestratorListeners();
    if (orchestrator) {
      orchestrator.destroy();
      orchestrator = null;
    }

    narrationPlayer.stop();
    stopCameraLoop();
    playbackClock.destroy();
    unsubscribeClock();

    if (mediaPlaying) {
      viewer.pause?.();
      mediaPlaying = false;
    }
  };

  return {
    loadStory,
    loadChapter,
    play,
    pause,
    stop,
    destroy,
    getState,
    currentChapterIndex,
    isLoading,
    playState,
    playbackState,
    getStory,
  };
};
