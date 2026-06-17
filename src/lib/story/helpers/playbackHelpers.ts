/**
 * Playback Helpers - Functions for media and narration playback
 */

import type { Chapter } from '../../core/types/story';

/**
 * Check if media segment has valid start and end times
 */
export const isValidSegment = (start: number | undefined, end: number | undefined): boolean => {
  if (start === undefined || end === undefined) return false;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end > start;
};

/**
 * Get narration segment for a chapter
 */
export const getNarrationSegment = (
  chapter: Chapter,
): { lang: string; start: number; end: number } | null => {
  if (!chapter.narrationSegment) return null;
  const firstLang = Object.keys(chapter.narrationSegment)[0];
  if (!firstLang) return null;
  const seg = chapter.narrationSegment[firstLang];
  if (!seg || !isValidSegment(seg.start, seg.end)) return null;
  return { lang: firstLang, start: seg.start, end: seg.end };
};

/**
 * Check if chapter has playable content (narration or media)
 */
export const hasPlayableContent = (chapter: Chapter): boolean => {
  const hasNarration = getNarrationSegment(chapter) !== null;
  const hasMedia = Boolean(chapter.media && isValidSegment(chapter.media.start, chapter.media.end));
  return hasNarration || hasMedia;
};
