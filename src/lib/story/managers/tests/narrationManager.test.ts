import { describe, it, expect, vi } from 'vitest';
import { writable } from 'svelte/store';
import { createNarrationManager, type NarrationManagerDeps } from '../narrationManager';

describe('Narration Manager', () => {
  describe('setTrack', () => {
    it('should set narration track with language and source', () => {
      const setNarrationTrack = vi.fn();
      const deps: NarrationManagerDeps = {
        selectedChapterId: writable(null),
        storyStore: {
          setNarrationTrack,
          setNarrationSegment: vi.fn(),
        },
      };

      const manager = createNarrationManager(deps);
      manager.setTrack('en', 'https://example.com/audio.mp3');

      expect(setNarrationTrack).toHaveBeenCalledWith({
        language: 'en',
        src: 'https://example.com/audio.mp3',
      });
    });
  });

  describe('assignSegment', () => {
    it('should assign segment when chapter is selected', () => {
      const setNarrationSegment = vi.fn();
      const selectedChapterId = writable('chapter-1');
      const deps: NarrationManagerDeps = {
        selectedChapterId,
        storyStore: {
          setNarrationTrack: vi.fn(),
          setNarrationSegment,
        },
      };

      const manager = createNarrationManager(deps);
      manager.assignSegment('en', 10, 20);

      expect(setNarrationSegment).toHaveBeenCalledWith({
        chapterId: 'chapter-1',
        language: 'en',
        start: 10,
        end: 20,
      });
    });

    it('should not assign segment when no chapter is selected', () => {
      const setNarrationSegment = vi.fn();
      const selectedChapterId = writable(null);
      const deps: NarrationManagerDeps = {
        selectedChapterId,
        storyStore: {
          setNarrationTrack: vi.fn(),
          setNarrationSegment,
        },
      };

      const manager = createNarrationManager(deps);
      manager.assignSegment('en', 10, 20);

      expect(setNarrationSegment).not.toHaveBeenCalled();
    });
  });
});
