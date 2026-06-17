import { describe, it, expect, vi } from 'vitest';
import { writable, readable, get } from 'svelte/store';
import { createChapterManager, type ChapterManagerDeps } from '../chapterManager';
import type { Story, Chapter } from '../../../core/types/story';

describe('Chapter Manager', () => {
  const createMockStory = (): Story => ({
    version: '1.0',
    type: 'story',
    chapters: [
      { id: 'chapter-1', manifest: 'manifest-1', canvasIndex: 0 } as Chapter,
      { id: 'chapter-2', manifest: 'manifest-2', canvasIndex: 1 } as Chapter,
    ],
  });

  describe('deleteChapter', () => {
    it('should delete chapter and clear selection if selected', () => {
      const deleteChapter = vi.fn();
      const selectedChapterId = writable('chapter-1');
      const deps: ChapterManagerDeps = {
        storyStore: readable(createMockStory()),
        selectedChapterId,
        storyStoreWrapper: { deleteChapter },
      };

      const manager = createChapterManager(deps);
      manager.deleteChapter('chapter-1');

      expect(deleteChapter).toHaveBeenCalledWith({ chapterId: 'chapter-1' });
      expect(get(selectedChapterId)).toBe(null);
    });

    it('should delete chapter without affecting selection if different chapter selected', () => {
      const deleteChapter = vi.fn();
      const selectedChapterId = writable('chapter-2');
      const deps: ChapterManagerDeps = {
        storyStore: readable(createMockStory()),
        selectedChapterId,
        storyStoreWrapper: { deleteChapter },
      };

      const manager = createChapterManager(deps);
      manager.deleteChapter('chapter-1');

      expect(deleteChapter).toHaveBeenCalledWith({ chapterId: 'chapter-1' });
      expect(get(selectedChapterId)).toBe('chapter-2');
    });
  });

  describe('selectChapter', () => {
    it('should select chapter and call callback with chapter data', () => {
      const selectedChapterId = writable(null);
      const story = createMockStory();
      const deps: ChapterManagerDeps = {
        storyStore: readable(story),
        selectedChapterId,
        storyStoreWrapper: { deleteChapter: vi.fn() },
      };

      const onSelect = vi.fn();
      const manager = createChapterManager(deps);
      manager.selectChapter('chapter-1', onSelect);

      expect(get(selectedChapterId)).toBe('chapter-1');
      expect(onSelect).toHaveBeenCalledWith(story.chapters[0]);
    });

    it('should deselect chapter when null passed', () => {
      const selectedChapterId = writable('chapter-1');
      const deps: ChapterManagerDeps = {
        storyStore: readable(createMockStory()),
        selectedChapterId,
        storyStoreWrapper: { deleteChapter: vi.fn() },
      };

      const onSelect = vi.fn();
      const manager = createChapterManager(deps);
      manager.selectChapter(null, onSelect);

      expect(get(selectedChapterId)).toBe(null);
      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('getSelectedChapter', () => {
    it('should return selected chapter', () => {
      const story = createMockStory();
      const selectedChapterId = writable('chapter-1');
      const deps: ChapterManagerDeps = {
        storyStore: readable(story),
        selectedChapterId,
        storyStoreWrapper: { deleteChapter: vi.fn() },
      };

      const manager = createChapterManager(deps);
      const chapter = manager.getSelectedChapter();

      expect(chapter).toEqual(story.chapters[0]);
    });

    it('should return null when no chapter selected', () => {
      const selectedChapterId = writable(null);
      const deps: ChapterManagerDeps = {
        storyStore: readable(createMockStory()),
        selectedChapterId,
        storyStoreWrapper: { deleteChapter: vi.fn() },
      };

      const manager = createChapterManager(deps);
      const chapter = manager.getSelectedChapter();

      expect(chapter).toBe(null);
    });
  });

  describe('getChapterById', () => {
    it('should return chapter by ID', () => {
      const story = createMockStory();
      const deps: ChapterManagerDeps = {
        storyStore: readable(story),
        selectedChapterId: writable(null),
        storyStoreWrapper: { deleteChapter: vi.fn() },
      };

      const manager = createChapterManager(deps);
      const chapter = manager.getChapterById('chapter-2');

      expect(chapter).toEqual(story.chapters[1]);
    });

    it('should return null for non-existent chapter', () => {
      const deps: ChapterManagerDeps = {
        storyStore: readable(createMockStory()),
        selectedChapterId: writable(null),
        storyStoreWrapper: { deleteChapter: vi.fn() },
      };

      const manager = createChapterManager(deps);
      const chapter = manager.getChapterById('non-existent');

      expect(chapter).toBe(null);
    });
  });

  describe('autoSelectFirstIfNeeded', () => {
    it('should select first chapter when none selected', () => {
      const story = createMockStory();
      const selectedChapterId = writable(null);
      const deps: ChapterManagerDeps = {
        storyStore: readable(story),
        selectedChapterId,
        storyStoreWrapper: { deleteChapter: vi.fn() },
      };

      return new Promise<void>((resolve) => {
        const onSelect = vi.fn((chapter) => {
          expect(chapter).toEqual(story.chapters[0]);
          expect(get(selectedChapterId)).toBe('chapter-1');
          resolve();
        });

        const manager = createChapterManager(deps);
        manager.autoSelectFirstIfNeeded(onSelect);
      });
    });

    it('should not select when chapter already selected', () => {
      const selectedChapterId = writable('chapter-2');
      const deps: ChapterManagerDeps = {
        storyStore: readable(createMockStory()),
        selectedChapterId,
        storyStoreWrapper: { deleteChapter: vi.fn() },
      };

      const onSelect = vi.fn();
      const manager = createChapterManager(deps);
      manager.autoSelectFirstIfNeeded(onSelect);

      // Should not change selection
      expect(get(selectedChapterId)).toBe('chapter-2');
    });
  });
});
