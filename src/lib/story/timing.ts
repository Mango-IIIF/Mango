import type { Chapter, ChapterEntryTransition } from '../core/types/story';

export const DEFAULT_ENTRY_TRANSITION: ChapterEntryTransition = {
  type: 'tween',
  durationMs: 2000,
  easing: 'ease-in-out',
};

export type ResolvedChapterTiming = {
  entryTransition: ChapterEntryTransition;
  presentationDurationMs: number;
  advanceDelayMs?: number;
  migratedFromLegacy: boolean;
};

const nonNegative = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

/**
 * Resolves old and new timing without adding in-chapter camera motion. Legacy
 * transitionTimeMs continues to drive both the existing entry tween and the
 * silent chapter presentation window until the author sets explicit values.
 */
export const resolveChapterTiming = (chapter: Chapter): ResolvedChapterTiming => {
  const legacyMs = nonNegative(chapter.transitionTimeMs);
  const explicitEntry = chapter.entryTransition;
  const entryTransition: ChapterEntryTransition = explicitEntry
    ? {
        type: explicitEntry.type,
        durationMs: nonNegative(explicitEntry.durationMs) ?? 0,
        ...(explicitEntry.easing ? { easing: explicitEntry.easing } : {}),
      }
    : {
        ...DEFAULT_ENTRY_TRANSITION,
        durationMs: legacyMs ?? DEFAULT_ENTRY_TRANSITION.durationMs,
      };

  return {
    entryTransition,
    presentationDurationMs:
      nonNegative(chapter.presentationDurationMs) ??
      legacyMs ??
      DEFAULT_ENTRY_TRANSITION.durationMs,
    ...(nonNegative(chapter.advance?.delayMs) !== undefined
      ? { advanceDelayMs: nonNegative(chapter.advance?.delayMs) }
      : {}),
    migratedFromLegacy:
      legacyMs !== undefined &&
      chapter.entryTransition === undefined &&
      chapter.presentationDurationMs === undefined,
  };
};

export const migrateLegacyChapterTiming = (chapter: Chapter): Chapter => {
  if (chapter.transitionTimeMs === undefined) return chapter;
  const resolved = resolveChapterTiming(chapter);
  const { transitionTimeMs: _legacy, ...rest } = chapter;
  return {
    ...rest,
    entryTransition: resolved.entryTransition,
    presentationDurationMs: resolved.presentationDurationMs,
  };
};
