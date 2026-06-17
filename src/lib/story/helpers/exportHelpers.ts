/**
 * Export Helpers - Functions for building export envelopes
 */

import type { Story } from '../../core/types/story';

export type ExportEnvelope = {
  version: 1;
  exportedAt: string;
  meta: {
    source: 'storybuilder';
    appVersion?: string;
  };
  data: Story;
};

/**
 * Build an export envelope with versioning and metadata
 */
export const buildExportEnvelope = (
  story: Story,
  appVersion?: string,
): ExportEnvelope => {
  const mapped = {
    ...story,
    chapters: story.chapters.map((chapter, index) => {
      const { advance, annotationPlacement, annotations, ...rest } = chapter as any;
      const transitionTimeMs = advance?.delayMs;
      const next: any = { ...rest, id: `chapter_${index + 1}` };
      const mergedAnnotations = { ...(annotations ?? {}) };
      
      // Push placement into each annotation entry if missing, or as a special key
      if (annotationPlacement) {
        for (const lang of Object.keys(mergedAnnotations)) {
          mergedAnnotations[lang] = {
            ...(mergedAnnotations[lang] ?? {}),
            placement: mergedAnnotations[lang]?.placement ?? annotationPlacement,
          };
        }
        // If no annotations exist, keep placement as fallback
        if (Object.keys(mergedAnnotations).length === 0) {
          mergedAnnotations._default = { placement: annotationPlacement };
        }
      }
      
      if (Object.keys(mergedAnnotations).length > 0) {
        next.annotations = mergedAnnotations;
      }
      if (transitionTimeMs !== undefined) {
        next.transitionTimeMs = transitionTimeMs;
      }
      return next;
    }),
  };
  
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    meta: {
      source: 'storybuilder',
      ...(appVersion ? { appVersion } : {}),
    },
    data: mapped as Story,
  };
};
