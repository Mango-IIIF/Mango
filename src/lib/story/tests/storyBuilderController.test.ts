import { describe, expect, it } from 'vitest';
import { collectLatestNarrationSegments } from '../storyBuilderController';

describe('story builder narration defaults', () => {
  it('keeps the latest valid range for each language', () => {
    expect(
      collectLatestNarrationSegments({
        chapters: [
          {
            id: 'chapter-1',
            manifest: 'https://example.org/manifest.json',
            canvasIndex: 0,
            narrationSegment: {
              en: { start: 2, end: 5 },
              cy: { start: 10, end: 14 },
            },
          },
          {
            id: 'chapter-2',
            manifest: 'https://example.org/manifest.json',
            canvasIndex: 1,
            narrationSegment: { en: { start: 6, end: 9 } },
          },
        ],
      }),
    ).toEqual({
      en: { start: 6, end: 9 },
      cy: { start: 10, end: 14 },
    });
  });
});
