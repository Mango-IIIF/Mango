import { describe, it, expect } from 'vitest';
import { isValidSegment, getNarrationSegment, hasPlayableContent } from '../playbackHelpers';
import type { Chapter } from '../../../core/types/story';

describe('playbackHelpers', () => {
  describe('isValidSegment', () => {
    it('should return true for valid segment', () => {
      expect(isValidSegment(0, 10)).toBe(true);
      expect(isValidSegment(5.5, 20.3)).toBe(true);
    });

    it('should return false for invalid segments', () => {
      expect(isValidSegment(undefined, 10)).toBe(false);
      expect(isValidSegment(10, undefined)).toBe(false);
      expect(isValidSegment(10, 5)).toBe(false); // end before start
      expect(isValidSegment(10, 10)).toBe(false); // equal
    });
  });

  describe('getNarrationSegment', () => {
    it('should return narration segment when valid', () => {
      const chapter: Chapter = {
        manifest: 'test',
        canvasIndex: 0,
        narration: {
          en: { start: 0, end: 10 },
        },
      } as any;

      const segment = getNarrationSegment(chapter);

      expect(segment).toEqual({ lang: 'en', start: 0, end: 10 });
    });

    it('should return null when no narration', () => {
      const chapter: Chapter = {
        manifest: 'test',
        canvasIndex: 0,
      } as any;

      expect(getNarrationSegment(chapter)).toBeNull();
    });

    it('should return null when narration segment is invalid', () => {
      const chapter: Chapter = {
        manifest: 'test',
        canvasIndex: 0,
        narration: {
          en: { start: 10, end: 5 }, // invalid: end before start
        },
      } as any;

      expect(getNarrationSegment(chapter)).toBeNull();
    });
  });

  describe('hasPlayableContent', () => {
    it('should return true when chapter has narration', () => {
      const chapter: Chapter = {
        manifest: 'test',
        canvasIndex: 0,
        narration: {
          en: { start: 0, end: 10 },
        },
      } as any;

      expect(hasPlayableContent(chapter)).toBe(true);
    });

    it('should return true when chapter has media', () => {
      const chapter: Chapter = {
        manifest: 'test',
        canvasIndex: 0,
        media: { start: 0, end: 10 },
      } as any;

      expect(hasPlayableContent(chapter)).toBe(true);
    });

    it('should return false when no playable content', () => {
      const chapter: Chapter = {
        manifest: 'test',
        canvasIndex: 0,
      } as any;

      expect(hasPlayableContent(chapter)).toBe(false);
    });
  });
});
