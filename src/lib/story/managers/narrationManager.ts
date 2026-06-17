/**
 * Narration Manager
 * 
 * Manages narration tracks and segments for chapters.
 * Extracted from storyBuilderController.ts to improve maintainability.
 * Part of CODE_REVIEW.md Priority 2.2: Decompose storyBuilderController.ts
 */

import { get } from 'svelte/store';
import type { Writable } from 'svelte/store';

export type NarrationManagerDeps = {
  selectedChapterId: Writable<string | null>;
  storyStore: {
    setNarrationTrack: (payload: { language: string; src: string }) => void;
    setNarrationSegment: (payload: { 
      chapterId: string; 
      language: string; 
      start: number; 
      end: number;
    }) => void;
  };
};

export type NarrationManager = {
  setTrack: (lang: string, src: string) => void;
  assignSegment: (lang: string, start: number, end: number) => void;
};

/**
 * Create a narration manager
 * 
 * @param deps - Dependencies (selectedChapterId store and story store wrapper)
 * @returns Narration manager with track and segment operations
 */
export const createNarrationManager = (deps: NarrationManagerDeps): NarrationManager => {
  const { selectedChapterId, storyStore } = deps;

  return {
    /**
     * Set a narration track for a language
     * 
     * @param lang - Language code
     * @param src - Audio source URL
     */
    setTrack: (lang: string, src: string) => {
      storyStore.setNarrationTrack({ language: lang, src });
    },

    /**
     * Assign a narration segment to the currently selected chapter
     * 
     * @param lang - Language code
     * @param start - Start time in seconds
     * @param end - End time in seconds
     */
    assignSegment: (lang: string, start: number, end: number) => {
      const id = get(selectedChapterId);
      if (!id) {
        console.warn('Cannot assign narration segment: no chapter selected');
        return;
      }
      storyStore.setNarrationSegment({ chapterId: id, language: lang, start, end });
    },
  };
};
