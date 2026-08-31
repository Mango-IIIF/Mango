import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import type { StoryState } from '../../core/types/story';
import { createStoryPreviewOrchestrator, getPreviewChapterDuration } from '../previewOrchestrator';

const story: StoryState = {
  chapters: [
    {
      id: 'chapter-1',
      manifest: 'manifest',
      canvasIndex: 0,
      media: { start: 1, end: 3 },
      advance: { mode: 'auto', delayMs: 500 },
    },
  ],
};

describe('story preview orchestration', () => {
  it('owns sequential selection, application, and completion', async () => {
    const selectChapter = vi.fn();
    const applyChapter = vi.fn();
    const wait = vi.fn(async () => undefined);
    const preview = createStoryPreviewOrchestrator({
      getStory: () => story,
      getSelectedChapterId: () => 'chapter-1',
      selectChapter,
      applyChapter,
      getNarrationSegment: () => ({ start: 0, end: 1 }),
      closeEditors: vi.fn(),
      stopPlayback: vi.fn(),
      wait,
    });

    await preview.start();

    expect(selectChapter).toHaveBeenCalledWith('chapter-1');
    expect(applyChapter).toHaveBeenCalledWith(story.chapters[0]);
    expect(wait).toHaveBeenNthCalledWith(1, 300);
    expect(wait).toHaveBeenNthCalledWith(2, 3500);
    expect(get(preview.isPreviewing)).toBe(false);
  });

  it('plays only the requested chapter when previewing a single chapter', async () => {
    const multiChapterStory: StoryState = {
      chapters: [
        { id: 'chapter-1', manifest: 'manifest', canvasIndex: 0 },
        { id: 'chapter-2', manifest: 'manifest', canvasIndex: 1 },
        { id: 'chapter-3', manifest: 'manifest', canvasIndex: 2 },
      ],
    };
    const selectChapter = vi.fn();
    const applyChapter = vi.fn();
    const closeEditors = vi.fn();
    const preview = createStoryPreviewOrchestrator({
      getStory: () => multiChapterStory,
      getSelectedChapterId: () => 'chapter-2',
      selectChapter,
      applyChapter,
      getNarrationSegment: () => null,
      closeEditors,
      stopPlayback: vi.fn(),
      wait: vi.fn(async () => undefined),
    });

    await preview.start({ chapterId: 'chapter-2', singleChapter: true });

    // Only the requested chapter plays; neighbours are never applied.
    expect(applyChapter).toHaveBeenCalledWith(multiChapterStory.chapters[1]);
    expect(applyChapter).not.toHaveBeenCalledWith(multiChapterStory.chapters[0]);
    expect(applyChapter).not.toHaveBeenCalledWith(multiChapterStory.chapters[2]);
    expect(closeEditors).toHaveBeenCalledOnce();
    expect(get(preview.isPreviewing)).toBe(false);
    // The editor returns to the chapter that was being edited.
    expect(selectChapter).toHaveBeenLastCalledWith('chapter-2');
  });

  it('releases chapter playback when a preview ends on its own', async () => {
    const stopPlayback = vi.fn();
    const preview = createStoryPreviewOrchestrator({
      getStory: () => story,
      getSelectedChapterId: () => 'chapter-1',
      selectChapter: vi.fn(),
      applyChapter: vi.fn(),
      getNarrationSegment: () => null,
      closeEditors: vi.fn(),
      stopPlayback,
      wait: vi.fn(async () => undefined),
    });

    await preview.start({ chapterId: 'chapter-1', singleChapter: true });

    // Reaching the end of a preview has to release playback exactly as
    // stopping it does. Otherwise the controller still believes this chapter
    // is playing and silently skips its narration the next time it is
    // previewed.
    expect(stopPlayback).toHaveBeenCalled();
  });

  it('ignores a preview request for a chapter that is not in the story', async () => {
    const applyChapter = vi.fn();
    const closeEditors = vi.fn();
    const preview = createStoryPreviewOrchestrator({
      getStory: () => story,
      getSelectedChapterId: () => 'chapter-1',
      selectChapter: vi.fn(),
      applyChapter,
      getNarrationSegment: () => null,
      closeEditors,
      stopPlayback: vi.fn(),
      wait: vi.fn(async () => undefined),
    });

    await preview.start({ chapterId: 'missing', singleChapter: true });

    expect(applyChapter).not.toHaveBeenCalled();
    expect(closeEditors).not.toHaveBeenCalled();
    expect(get(preview.isPreviewing)).toBe(false);
  });

  it('does not hold a chapter open for a camera track that cannot animate', () => {
    const narrated = { start: 0, end: 4.67 };
    const base = {
      id: 'chapter_3',
      manifest: 'manifest',
      canvasIndex: 0,
      narrationSegment: { en: narrated },
    };

    // Opening the motion tools and setting a duration without placing points
    // leaves a track that moves nothing. It must not pad the chapter.
    expect(
      getPreviewChapterDuration(
        { ...base, cameraTrack: { durationMs: 8000, keyframes: [] } },
        narrated,
      ),
    ).toBe(4670);

    // A single point cannot describe movement either.
    expect(
      getPreviewChapterDuration(
        {
          ...base,
          cameraTrack: {
            durationMs: 8000,
            keyframes: [{ id: 'a', timeMs: 0, viewBox: { x: 0, y: 0, w: 10, h: 10 } }],
          },
        },
        narrated,
      ),
    ).toBe(4670);

    // Two points do, so the chapter waits for the camera to finish.
    expect(
      getPreviewChapterDuration(
        {
          ...base,
          cameraTrack: {
            durationMs: 8000,
            keyframes: [
              { id: 'a', timeMs: 0, viewBox: { x: 0, y: 0, w: 10, h: 10 } },
              { id: 'b', timeMs: 8000, viewBox: { x: 5, y: 0, w: 10, h: 10 } },
            ],
          },
        },
        narrated,
      ),
    ).toBe(8000);

    // Dwell is additional hold time before the configured movement duration.
    expect(
      getPreviewChapterDuration(
        {
          ...base,
          cameraTrack: {
            durationMs: 8000,
            keyframes: [
              {
                id: 'a',
                timeMs: 0,
                dwellMs: 2000,
                viewBox: { x: 0, y: 0, w: 10, h: 10 },
              },
              { id: 'b', timeMs: 10_000, viewBox: { x: 5, y: 0, w: 10, h: 10 } },
            ],
          },
        },
        narrated,
      ),
    ).toBe(10_000);
  });

  it('uses a visible default duration for silent chapters', () => {
    expect(
      getPreviewChapterDuration(
        {
          id: 'silent',
          manifest: 'manifest',
          canvasIndex: 0,
        },
        null,
      ),
    ).toBe(2000);
  });
});
