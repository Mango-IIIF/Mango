import type { StoryViewerRuntime } from './storyViewerController';

/**
 * The playback half of the story viewer, as plain reactive values.
 *
 * `StoryViewerRuntime` publishes its progress through Svelte stores, but the
 * layout renders plain values, so every store had a hand-written subscription
 * mirroring it into a `$state` variable and a matching `onDestroy` — six
 * subscriptions and five teardown calls interleaved with everything else the
 * layout does. The mirroring is mechanical and always the same shape, so it
 * belongs together rather than spread through a 4500-line component.
 *
 * Loading a story is deliberately *not* here. Whether controls are usable and
 * how many chapters exist are answers the loader owns, so they arrive as
 * getters: this presenter reports where playback is, and refuses commands it
 * is told not to accept.
 */

export type StoryPlaybackGuards = {
  /** False while no story is loaded, or the viewer cannot accept commands. */
  canControl: () => boolean;
  /** False while a story or chapter is still being fetched. */
  canNavigate: () => boolean;
  /** Chapters in the loaded story. Navigation clamps to this. */
  chapterCount: () => number;
};

export type StageFade = { opacity: number; durationMs: number };

export type StoryPlaybackDeps = {
  runtime: StoryViewerRuntime;
  guards: StoryPlaybackGuards;
  /**
   * The story builder drives the same stage from a plugin rather than through
   * the runtime, so its fades arrive on the event bus instead. Returns an
   * unsubscribe.
   */
  onExternalStageFade?: (handler: (fade: StageFade) => void) => () => void;
};

export type StoryPlayback = ReturnType<typeof createStoryPlayback>;

export function createStoryPlayback({
  runtime,
  guards,
  onExternalStageFade,
}: StoryPlaybackDeps) {
  let currentChapterIndex = $state(0);
  let isLoading = $state(false);
  let playState: 'idle' | 'playing' | 'paused' = $state('idle');
  let chapterDurationSec = $state(0);
  let chapterElapsedSec = $state(0);
  let stageOpacity = $state(1);
  let stageFadeMs = $state(0);

  const unsubscribers: Array<() => void> = [
    runtime.currentChapterIndex.subscribe((value) => {
      currentChapterIndex = value ?? 0;
    }),
    runtime.isLoading.subscribe((value) => {
      isLoading = value;
      // A chapter that is still arriving has no meaningful progress yet, and
      // leaving the previous chapter's numbers on screen reads as a stall.
      if (value) {
        chapterElapsedSec = 0;
        chapterDurationSec = 0;
      }
    }),
    runtime.playState.subscribe((value) => {
      playState = value;
    }),
    runtime.playbackState.subscribe((value) => {
      chapterDurationSec = value?.duration ?? 0;
      chapterElapsedSec = value?.currentTime ?? 0;
    }),
    runtime.stageFade.subscribe((value) => {
      stageOpacity = value?.opacity ?? 1;
      stageFadeMs = value?.durationMs ?? 0;
    }),
  ];

  if (onExternalStageFade) {
    unsubscribers.push(
      onExternalStageFade(({ opacity, durationMs }) => {
        stageOpacity = opacity;
        stageFadeMs = durationMs;
      }),
    );
  }

  const selectChapter = (index: number, autoPlay = true) => {
    if (!guards.canNavigate()) return;
    const total = guards.chapterCount();
    if (!total) return;
    const target = Math.max(0, Math.min(index, total - 1));
    // Set optimistically so the controls track the click rather than the
    // round trip; the runtime subscription corrects it if the load lands
    // somewhere else.
    currentChapterIndex = target;
    void runtime.loadChapter(target, { autoPlay });
  };

  return {
    get currentChapterIndex() {
      return currentChapterIndex;
    },
    get isLoading() {
      return isLoading;
    },
    get playState() {
      return playState;
    },
    get chapterDurationSec() {
      return chapterDurationSec;
    },
    get chapterElapsedSec() {
      return chapterElapsedSec;
    },
    get stageOpacity() {
      return stageOpacity;
    },
    get stageFadeMs() {
      return stageFadeMs;
    },

    play: () => {
      if (guards.canControl()) runtime.play();
    },
    pause: () => {
      if (guards.canControl()) runtime.pause();
    },
    stop: () => {
      if (guards.canControl()) runtime.stop();
    },
    selectChapter,
    previousChapter: () => selectChapter(currentChapterIndex - 1, true),
    nextChapter: () => selectChapter(currentChapterIndex + 1, true),
    refresh: () => {
      if (!guards.canNavigate()) return;
      void runtime.loadChapter(currentChapterIndex, { autoPlay: false });
    },

    /**
     * Clears chapter progress without touching the runtime, for when the
     * layout stops presenting a story at all and stale numbers would outlive
     * the thing they described.
     */
    resetProgress: () => {
      chapterDurationSec = 0;
      chapterElapsedSec = 0;
    },

    destroy: () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      unsubscribers.length = 0;
    },
  };
}
