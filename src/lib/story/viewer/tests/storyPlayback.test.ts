import { describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';
import { createStoryPlayback, type StoryPlaybackGuards } from '../storyPlayback.svelte';
import type { StoryViewerRuntime } from '../storyViewerController';

const createFakeRuntime = () => {
  const currentChapterIndex = writable<number | null>(0);
  const isLoading = writable(false);
  const playState = writable<'idle' | 'playing' | 'paused'>('idle');
  const playbackState = writable<{ duration: number; currentTime: number } | null>(null);
  const stageFade = writable<{ opacity: number; durationMs: number } | null>(null);

  const runtime = {
    currentChapterIndex,
    isLoading,
    playState,
    playbackState,
    stageFade,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    loadChapter: vi.fn(() => Promise.resolve()),
  } as unknown as StoryViewerRuntime;

  return { runtime, currentChapterIndex, isLoading, playState, playbackState, stageFade };
};

const openGuards = (chapterCount = 4): StoryPlaybackGuards => ({
  canControl: () => true,
  canNavigate: () => true,
  chapterCount: () => chapterCount,
});

describe('story playback presenter', () => {
  it('mirrors runtime stores into reactive values', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards() });

    fake.currentChapterIndex.set(2);
    fake.playState.set('playing');
    fake.playbackState.set({ duration: 30, currentTime: 12 });
    fake.stageFade.set({ opacity: 0.5, durationMs: 400 });

    expect(playback.currentChapterIndex).toBe(2);
    expect(playback.playState).toBe('playing');
    expect(playback.chapterDurationSec).toBe(30);
    expect(playback.chapterElapsedSec).toBe(12);
    expect(playback.stageOpacity).toBe(0.5);
    expect(playback.stageFadeMs).toBe(400);

    playback.destroy();
  });

  it('treats a null chapter index as the first chapter', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards() });

    fake.currentChapterIndex.set(null);
    expect(playback.currentChapterIndex).toBe(0);

    playback.destroy();
  });

  it('clears stale progress while a chapter is loading', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards() });

    fake.playbackState.set({ duration: 30, currentTime: 12 });
    fake.isLoading.set(true);

    expect(playback.isLoading).toBe(true);
    expect(playback.chapterDurationSec).toBe(0);
    expect(playback.chapterElapsedSec).toBe(0);

    playback.destroy();
  });

  it('clamps navigation to the chapter range', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards(4) });

    playback.selectChapter(99);
    expect(fake.runtime.loadChapter).toHaveBeenLastCalledWith(3, { autoPlay: true });

    playback.selectChapter(-5);
    expect(fake.runtime.loadChapter).toHaveBeenLastCalledWith(0, { autoPlay: true });

    playback.destroy();
  });

  /*
   * Fresh instances per direction on purpose. Selecting a chapter moves the
   * presenter's own index optimistically without moving the runtime store, so
   * re-setting the store to the value it already holds is a no-op — Svelte
   * skips equal primitives — and a shared instance would silently step from
   * the optimistic value instead of the one the test just asked for.
   */
  it('steps back from the current chapter', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards(4) });

    fake.currentChapterIndex.set(2);
    playback.previousChapter();

    expect(fake.runtime.loadChapter).toHaveBeenLastCalledWith(1, { autoPlay: true });
    playback.destroy();
  });

  it('steps forward from the current chapter', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards(4) });

    fake.currentChapterIndex.set(2);
    playback.nextChapter();

    expect(fake.runtime.loadChapter).toHaveBeenLastCalledWith(3, { autoPlay: true });
    playback.destroy();
  });

  /*
   * The optimistic write is what keeps the controls tracking a click rather
   * than the round trip, so it needs to survive until the runtime disagrees.
   */
  it('moves its own index immediately, before the runtime reports back', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards(4) });

    playback.selectChapter(2);
    expect(playback.currentChapterIndex).toBe(2);

    fake.currentChapterIndex.set(1);
    expect(playback.currentChapterIndex).toBe(1);

    playback.destroy();
  });

  it('reloads the current chapter without autoplay on refresh', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards() });

    fake.currentChapterIndex.set(1);
    playback.refresh();

    expect(fake.runtime.loadChapter).toHaveBeenLastCalledWith(1, { autoPlay: false });

    playback.destroy();
  });

  it('refuses transport commands the guards reject', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({
      runtime: fake.runtime,
      guards: { canControl: () => false, canNavigate: () => false, chapterCount: () => 4 },
    });

    playback.play();
    playback.pause();
    playback.stop();
    playback.selectChapter(2);
    playback.refresh();

    expect(fake.runtime.play).not.toHaveBeenCalled();
    expect(fake.runtime.pause).not.toHaveBeenCalled();
    expect(fake.runtime.stop).not.toHaveBeenCalled();
    expect(fake.runtime.loadChapter).not.toHaveBeenCalled();

    playback.destroy();
  });

  it('refuses navigation into a story with no chapters', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards(0) });

    playback.selectChapter(0);
    expect(fake.runtime.loadChapter).not.toHaveBeenCalled();

    playback.destroy();
  });

  it('accepts stage fades from an external source', () => {
    const fake = createFakeRuntime();
    let emit: ((fade: { opacity: number; durationMs: number }) => void) | null = null;
    const unsubscribe = vi.fn();

    const playback = createStoryPlayback({
      runtime: fake.runtime,
      guards: openGuards(),
      onExternalStageFade: (handler) => {
        emit = handler;
        return unsubscribe;
      },
    });

    emit!({ opacity: 0.25, durationMs: 120 });
    expect(playback.stageOpacity).toBe(0.25);
    expect(playback.stageFadeMs).toBe(120);

    playback.destroy();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('stops tracking the runtime once destroyed', () => {
    const fake = createFakeRuntime();
    const playback = createStoryPlayback({ runtime: fake.runtime, guards: openGuards() });

    playback.destroy();
    fake.currentChapterIndex.set(3);
    fake.playState.set('playing');

    expect(playback.currentChapterIndex).toBe(0);
    expect(playback.playState).toBe('idle');
  });
});
