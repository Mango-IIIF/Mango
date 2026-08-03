import { get, writable, type Readable } from 'svelte/store';
import type { Chapter, StoryState } from '../core/types/story';
import { resolveChapterTiming } from './timing';

export type StoryPreviewStartOptions = {
  /** Chapter to start from. Defaults to the first chapter in the story. */
  chapterId?: string;
  /** Play only the starting chapter instead of continuing through the story. */
  singleChapter?: boolean;
};

export type StoryPreviewOrchestrator = {
  isPreviewing: Readable<boolean>;
  start: (options?: StoryPreviewStartOptions) => Promise<void>;
  stop: () => void;
};

export const getPreviewChapterDuration = (
  chapter: Chapter,
  narration: { start: number; end: number } | null,
): number => {
  let sequentialMediaMs = 0;
  if (narration) sequentialMediaMs += (narration.end - narration.start) * 1000;
  if (chapter.media) {
    sequentialMediaMs += (chapter.media.end - chapter.media.start) * 1000;
  }
  const presentationMs = Math.max(
    sequentialMediaMs,
    chapter.cameraTrack?.durationMs ?? 0,
    resolveChapterTiming(chapter).presentationDurationMs,
  );
  let durationMs = presentationMs;
  if (chapter.advance?.mode === 'auto' && chapter.advance.delayMs) {
    durationMs += chapter.advance.delayMs;
  }
  return durationMs;
};

export const createStoryPreviewOrchestrator = ({
  getStory,
  getSelectedChapterId,
  selectChapter,
  applyChapter,
  getNarrationSegment,
  closeEditors,
  stopPlayback,
  wait = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
}: {
  getStory: () => StoryState;
  getSelectedChapterId: () => string | null;
  selectChapter: (chapterId: string) => void;
  applyChapter: (chapter: Chapter) => void;
  getNarrationSegment: (chapter: Chapter) => { start: number; end: number } | null;
  closeEditors: () => void;
  stopPlayback: () => void;
  wait?: (durationMs: number) => Promise<unknown>;
}): StoryPreviewOrchestrator => {
  const isPreviewing = writable(false);
  let token = 0;
  let restoreChapterId: string | null = null;

  const restoreEditorChapter = () => {
    const chapterId = restoreChapterId;
    restoreChapterId = null;
    if (!chapterId) return;
    const chapter = getStory().chapters.find((entry) => entry.id === chapterId);
    if (!chapter) return;
    selectChapter(chapter.id);
    applyChapter(chapter);
  };

  const stop = () => {
    token += 1;
    isPreviewing.set(false);
    stopPlayback();
    restoreEditorChapter();
  };

  const start = async (options: StoryPreviewStartOptions = {}) => {
    if (get(isPreviewing) || getStory().chapters.length === 0) return;

    let chapterIndex = 0;
    if (options.chapterId) {
      chapterIndex = getStory().chapters.findIndex(
        (entry) => entry.id === options.chapterId,
      );
      if (chapterIndex === -1) return;
    }

    isPreviewing.set(true);
    restoreChapterId = getSelectedChapterId();
    closeEditors();
    const activeToken = ++token;

    while (activeToken === token) {
      const chapter = getStory().chapters[chapterIndex];
      if (!chapter) break;
      selectChapter(chapter.id);
      applyChapter(chapter);
      await wait(300);
      await wait(getPreviewChapterDuration(chapter, getNarrationSegment(chapter)));
      if (activeToken !== token) break;
      if (options.singleChapter) break;
      chapterIndex += 1;
    }

    if (activeToken === token) {
      isPreviewing.set(false);
      // Reaching the end releases playback just as stopping does. Without
      // this the controller still holds the last previewed chapter as the
      // one playing, and previewing that same chapter again is skipped by
      // its "already playing" guard — the chapter replays silently.
      stopPlayback();
      restoreEditorChapter();
    }
  };

  return { isPreviewing, start, stop };
};
