export type NarrationSegment = {
  src: string;
  start: number;
  end: number;
};

export type NarrationPlayer = {
  playSegment: (segment: NarrationSegment) => Promise<boolean>;
  stop: () => void;
  pause: () => boolean;
  resume: () => boolean;
  isPlaying: () => boolean;
  getCurrentTime?: () => number | null;
};

type NarrationPlayerOptions = {
  onBufferingChange?: (isBuffering: boolean) => void;
};

export const createNarrationPlayer = (
  options: NarrationPlayerOptions = {},
): NarrationPlayer => {
  let audio: HTMLAudioElement | null = null;
  let activeToken = 0;
  let playing = false;
  let paused = false;
  let pausedTime = 0;
  let activeFinish: ((ok: boolean) => void) | null = null;
  let activeCleanup: (() => void) | null = null;

  const ensureAudio = (): HTMLAudioElement | null => {
    if (audio) return audio;
    if (typeof Audio === 'undefined') return null;
    audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    return audio;
  };

  const stop = () => {
    activeToken += 1;
    playing = false;
    paused = false;
    options.onBufferingChange?.(false);
    if (audio) {
      audio.pause();
    }
    const finish = activeFinish;
    const cleanup = activeCleanup;
    activeFinish = null;
    activeCleanup = null;
    cleanup?.();
    finish?.(false);
  };

  const playSegment = (segment: NarrationSegment): Promise<boolean> => {
    const audioEl = ensureAudio();
    if (!audioEl) return Promise.resolve(false);
    if (!segment.src) return Promise.resolve(false);
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end)) {
      return Promise.resolve(false);
    }
    if (segment.end <= segment.start) return Promise.resolve(false);

    const token = (activeToken += 1);
    playing = true;
    paused = false;

    return new Promise((resolve) => {
      let finished = false;
      let startupTimer: ReturnType<typeof setTimeout> | null = null;
      let started = false;

      const finish = (ok: boolean) => {
        if (finished) return;
        finished = true;
        if (token !== activeToken) ok = false;
        playing = false;
        paused = false;
        options.onBufferingChange?.(false);
        cleanup();
        resolve(ok);
      };

      const handleTimeUpdate = () => {
        if (token !== activeToken) return;
        if (audioEl.currentTime >= segment.end) {
          audioEl.pause();
          finish(true);
        }
      };

      const handleEnded = () => {
        finish(true);
      };

      const handleCanPlay = () => {
        if (token !== activeToken) return;
        if (started) return;
        started = true;
        audioEl.currentTime = Math.max(0, segment.start);
        options.onBufferingChange?.(true);
        void audioEl.play().catch(() => finish(false));
      };

      const handleWaiting = () => {
        if (token !== activeToken) return;
        options.onBufferingChange?.(true);
      };

      const handlePlaying = () => {
        if (token !== activeToken) return;
        options.onBufferingChange?.(false);
      };

      const cleanup = () => {
        audioEl.removeEventListener('timeupdate', handleTimeUpdate);
        audioEl.removeEventListener('ended', handleEnded);
        audioEl.removeEventListener('canplay', handleCanPlay);
        audioEl.removeEventListener('canplaythrough', handleCanPlay);
        audioEl.removeEventListener('loadedmetadata', handleCanPlay);
        audioEl.removeEventListener('waiting', handleWaiting);
        audioEl.removeEventListener('playing', handlePlaying);
        if (startupTimer) {
          clearTimeout(startupTimer);
          startupTimer = null;
        }
      };

      activeFinish = finish;
      activeCleanup = cleanup;

      audioEl.addEventListener('timeupdate', handleTimeUpdate);
      audioEl.addEventListener('ended', handleEnded);
      audioEl.addEventListener('waiting', handleWaiting);
      audioEl.addEventListener('playing', handlePlaying);

      if (audioEl.src !== segment.src) {
        audioEl.src = segment.src;
        audioEl.load();
      }

      if (audioEl.readyState >= 2) {
        handleCanPlay();
      } else {
        audioEl.addEventListener('canplay', handleCanPlay, { once: true });
        audioEl.addEventListener('canplaythrough', handleCanPlay, { once: true });
        audioEl.addEventListener('loadedmetadata', handleCanPlay, { once: true });
        startupTimer = setTimeout(() => {
          handleCanPlay();
        }, 2500);
      }
    });
  };

  const pause = (): boolean => {
    if (!audio || !playing) return false;
    pausedTime = audio.currentTime;
    audio.pause();
    playing = false;
    paused = true;
    return true;
  };

  const resume = (): boolean => {
    if (!audio || !paused) return false;
    audio.currentTime = pausedTime;
    playing = true;
    paused = false;
    void audio.play().catch(() => {
      playing = false;
      paused = false;
    });
    return true;
  };

  const isPlaying = () => playing;

  const getCurrentTime = (): number | null => {
    if (!audio) return null;
    if (!Number.isFinite(audio.currentTime)) return null;
    return audio.currentTime;
  };

  return { playSegment, stop, pause, resume, isPlaying, getCurrentTime };
};
