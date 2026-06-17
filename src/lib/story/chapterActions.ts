import type { AnnotationPlacement, ChapterAdvance, Story } from '../core/types/story';

export type ChapterActionsDeps = {
  getSelectedChapterId: () => string | null;
  storyStoreWrapper: {
    setNarrationTrack: (payload: { language: string; src: string }) => void;
    setChapterTitle: (payload: { chapterId: string; language: string; value: string }) => void;
    setChapterDescription: (payload: { chapterId: string; language: string; value: string }) => void;
    setNarrationSegment: (payload: {
      chapterId: string;
      language: string;
      start: number;
      end: number;
    }) => void;
    setAnnotationText: (payload: { chapterId: string; language: string; text: string }) => void;
    setAnnotationPlacement: (payload: {
      chapterId: string;
      language: string;
      placement: AnnotationPlacement;
    }) => void;
    setAdvanceMode: (payload: { chapterId: string; mode: ChapterAdvance['mode'] }) => void;
    setDelay: (payload: { chapterId: string; delayMs?: number }) => void;
    setChapterManifest: (payload: { chapterId: string; manifest: string }) => void;
    deleteChapter: (payload: { chapterId: string }) => void;
    reorderChapter: (payload: {
      chapterId: string;
      targetChapterId: string;
      position: 'before' | 'after';
    }) => void;
  };
};

export type ChapterActions = {
  deleteChapter: (chapterId: string, onSelectedDeleted?: () => void) => void;
  reorderChapter: (
    chapterId: string,
    targetChapterId: string,
    position?: 'before' | 'after',
  ) => void;
  setNarrationTrack: (lang: string, src: string) => void;
  updateChapterTitle: (lang: string, value: string) => void;
  updateChapterDescription: (lang: string, value: string) => void;
  assignNarrationSegment: (lang: string, start: number, end: number) => void;
  updateAnnotationText: (lang: string, text: string) => void;
  updateAnnotationPlacement: (lang: string, placement: AnnotationPlacement) => void;
  updateAdvanceMode: (mode: ChapterAdvance['mode']) => void;
  updateDelay: (delayMs?: number) => void;
  updateManifest: (manifest: string) => void;
};

export const createChapterActions = (deps: ChapterActionsDeps): ChapterActions => {
  const getId = () => deps.getSelectedChapterId();

  return {
    deleteChapter: (chapterId, onSelectedDeleted) => {
      deps.storyStoreWrapper.deleteChapter({ chapterId });
      if (getId() === chapterId) {
        onSelectedDeleted?.();
      }
    },
    reorderChapter: (chapterId, targetChapterId, position = 'before') => {
      deps.storyStoreWrapper.reorderChapter({ chapterId, targetChapterId, position });
    },
    setNarrationTrack: (lang, src) => {
      deps.storyStoreWrapper.setNarrationTrack({ language: lang, src });
    },
    updateChapterTitle: (lang, value) => {
      const id = getId();
      if (!id) return;
      deps.storyStoreWrapper.setChapterTitle({ chapterId: id, language: lang, value });
    },
    updateChapterDescription: (lang, value) => {
      const id = getId();
      if (!id) return;
      deps.storyStoreWrapper.setChapterDescription({ chapterId: id, language: lang, value });
    },
    assignNarrationSegment: (lang, start, end) => {
      const id = getId();
      if (!id) return;
      deps.storyStoreWrapper.setNarrationSegment({ chapterId: id, language: lang, start, end });
    },
    updateAnnotationText: (lang, text) => {
      const id = getId();
      if (!id) return;
      deps.storyStoreWrapper.setAnnotationText({ chapterId: id, language: lang, text });
    },
    updateAnnotationPlacement: (lang, placement) => {
      const id = getId();
      if (!id) return;
      deps.storyStoreWrapper.setAnnotationPlacement({ chapterId: id, language: lang, placement });
    },
    updateAdvanceMode: (mode) => {
      const id = getId();
      if (!id) return;
      deps.storyStoreWrapper.setAdvanceMode({ chapterId: id, mode });
    },
    updateDelay: (delayMs) => {
      const id = getId();
      if (!id) return;
      deps.storyStoreWrapper.setDelay({ chapterId: id, delayMs });
    },
    updateManifest: (manifest) => {
      const id = getId();
      if (!id) return;
      deps.storyStoreWrapper.setChapterManifest({ chapterId: id, manifest });
    },
  };
};
