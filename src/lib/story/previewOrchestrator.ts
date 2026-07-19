import { get, writable, type Readable } from 'svelte/store';
import type { Chapter, StoryState } from '../core/types/story';

export type StoryPreviewOrchestrator = {
  isPreviewing: Readable<boolean>;
  start: () => Promise<void>;
  stop: () => void;
};

export const getPreviewChapterDuration = (
  chapter: Chapter,
  narration: { start: number; end: number } | null,
): number => {
  let durationMs = 0;
  if (narration) durationMs += (narration.end - narration.start) * 1000;
  if (chapter.media) {
    durationMs += (chapter.media.end - chapter.media.start) * 1000;
  }
  if (chapter.advance?.mode === 'auto' && chapter.advance.delayMs) {
    durationMs += chapter.advance.delayMs;
  }
  return durationMs || 2000;
};

export const createStoryPreviewOrchestrator = ({
  getStory,
  selectChapter,
  applyChapter,
  getNarrationSegment,
  closeEditors,
  stopPlayback,
  wait = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
}: {
  getStory: () => StoryState;
  selectChapter: (chapterId: string) => void;
  applyChapter: (chapter: Chapter) => void;
  getNarrationSegment: (chapter: Chapter) => { start: number; end: number } | null;
  closeEditors: () => void;
  stopPlayback: () => void;
  wait?: (durationMs: number) => Promise<unknown>;
}): StoryPreviewOrchestrator => {
  const isPreviewing = writable(false);
  let token = 0;

  const stop = () => {
    token += 1;
    isPreviewing.set(false);
    stopPlayback();
  };

  const start = async () => {
    if (get(isPreviewing) || getStory().chapters.length === 0) return;
    isPreviewing.set(true);
    closeEditors();
    const activeToken = ++token;
    let chapterIndex = 0;

    while (activeToken === token) {
      const chapter = getStory().chapters[chapterIndex];
      if (!chapter) break;
      selectChapter(chapter.id);
      applyChapter(chapter);
      await wait(300);
      await wait(getPreviewChapterDuration(chapter, getNarrationSegment(chapter)));
      if (activeToken !== token) break;
      chapterIndex += 1;
    }

    if (activeToken === token) isPreviewing.set(false);
  };

  return { isPreviewing, start, stop };
};
