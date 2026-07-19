/**
 * Chapter Manager
 * 
 * Manages chapter CRUD operations and selection.
 * Extracted from storyBuilderController.ts to improve maintainability.
 * Part of CODE_REVIEW.md Priority 2.2: Decompose storyBuilderController.ts
 */

import { get } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';
import type { Chapter, StoryState } from '../../core/types/story';

export type ChapterManagerDeps = {
  storyStore: Readable<StoryState>;
  selectedChapterId: Writable<string | null>;
  storyStoreWrapper: {
    deleteChapter: (payload: { chapterId: string }) => void;
  };
};

export type ChapterManager = {
  deleteChapter: (chapterId: string) => void;
  selectChapter: (chapterId: string | null, onSelect?: (chapter: Chapter | null) => void) => void;
  getSelectedChapter: () => Chapter | null;
  getChapterById: (chapterId: string) => Chapter | null;
  autoSelectFirstIfNeeded: (onSelect?: (chapter: Chapter) => void) => void;
};

/**
 * Create a chapter manager
 * 
 * @param deps - Dependencies (story store, selected chapter ID, store wrapper)
 * @returns Chapter manager with CRUD and selection operations
 */
export const createChapterManager = (deps: ChapterManagerDeps): ChapterManager => {
  const { storyStore, selectedChapterId, storyStoreWrapper } = deps;

  return {
    /**
     * Delete a chapter by ID
     * If the deleted chapter is currently selected, clears the selection
     * 
     * @param chapterId - ID of chapter to delete
     */
    deleteChapter: (chapterId: string) => {
      storyStoreWrapper.deleteChapter({ chapterId });
      
      // Clear selection if deleted chapter was selected
      const currentSelection = get(selectedChapterId);
      if (currentSelection === chapterId) {
        selectedChapterId.set(null);
      }
    },

    /**
     * Select a chapter by ID
     * 
     * @param chapterId - ID of chapter to select (null to deselect)
     * @param onSelect - Optional callback called with the selected chapter
     */
    selectChapter: (chapterId: string | null, onSelect?: (chapter: Chapter | null) => void) => {
      selectedChapterId.set(chapterId);
      
      if (onSelect) {
        if (!chapterId) {
          onSelect(null);
        } else {
          const storyValue = get(storyStore);
          const chapter = storyValue.chapters.find((item) => item.id === chapterId) ?? null;
          onSelect(chapter);
        }
      }
    },

    /**
     * Get the currently selected chapter
     * 
     * @returns Selected chapter or null
     */
    getSelectedChapter: (): Chapter | null => {
      const chapterId = get(selectedChapterId);
      if (!chapterId) return null;
      
      const storyValue = get(storyStore);
      return storyValue.chapters.find((item) => item.id === chapterId) ?? null;
    },

    /**
     * Get a chapter by ID
     * 
     * @param chapterId - Chapter ID
     * @returns Chapter or null if not found
     */
    getChapterById: (chapterId: string): Chapter | null => {
      const storyValue = get(storyStore);
      return storyValue.chapters.find((item) => item.id === chapterId) ?? null;
    },

    /**
     * Auto-select the first chapter if available and no chapter is currently selected
     * This ensures the editor shows content on load instead of placeholder messages
     * 
     * @param onSelect - Optional callback called with the selected chapter
     */
    autoSelectFirstIfNeeded: (onSelect?: (chapter: Chapter) => void) => {
      const currentStory = get(storyStore);
      const firstChapter = currentStory.chapters?.[0];
      const currentSelection = get(selectedChapterId);
      
      if (firstChapter?.id && currentSelection === null) {
        // Use setTimeout to ensure viewer is fully initialized after attach
        setTimeout(() => {
          selectedChapterId.set(firstChapter.id);
          if (onSelect) {
            onSelect(firstChapter);
          }
        }, 0);
      }
    },
  };
};
