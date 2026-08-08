import { describe, expect, it } from 'vitest';
import type { StoryState } from '../../core/types/story';
import { normalizeStoryAnnotations } from '../normalizeAnnotations';

const legacyStory = (): StoryState => ({
  id: 'https://example.org/story',
  title: { en: 'Legacy story' },
  chapters: [
    {
      id: 'chapter-6',
      manifest: 'https://example.org/manifest',
      canvasId: 'https://example.org/canvas/6',
      canvasIndex: 5,
      viewBox: { x: 100, y: 200, w: 1_000, h: 800 },
      annotations: {
        en: {
          text: 'English text',
          placement: { x: 0.2, y: 0.25, w: 0.4, h: 0.2 },
        },
        cy: { text: 'Testun Cymraeg' },
      },
    },
  ],
});

describe('legacy story annotation migration', () => {
  it('preserves language and absolute placement and is idempotent', () => {
    const migrated = normalizeStoryAnnotations(legacyStory());
    const drawing = migrated.chapters[0].drawingAnnotations?.[0];
    expect(drawing?.label).toEqual({
      en: 'English text',
      cy: 'Testun Cymraeg',
    });
    expect(drawing?.rect).toEqual({ x: 300, y: 400, w: 400, h: 160 });
    expect(migrated.chapters[0].annotations).toBeUndefined();
    expect(normalizeStoryAnnotations(migrated)).toEqual(migrated);
  });
});
