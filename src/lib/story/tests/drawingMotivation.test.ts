import { describe, expect, it } from 'vitest';
import { storyDrawingDocument } from '../storyDrawingAnnotations';
import type { ChapterDrawingAnnotation } from '../../core/types/story';

const rect = (extra: Partial<ChapterDrawingAnnotation> = {}): ChapterDrawingAnnotation => ({
  id: 'd1',
  type: 'rectangle',
  rect: { x: 10, y: 20, w: 30, h: 40 },
  ...extra,
});

const motivationOf = (drawing: ChapterDrawingAnnotation) =>
  storyDrawingDocument(drawing, 'https://example.org/canvas/1', ['en'])?.motivation;

describe('story drawing motivation', () => {
  /*
   * The inference is what every story written before the control relied on,
   * so it has to survive: a region with words reads as a comment, one
   * without as a highlight.
   */
  it('infers from the shape when the author has not chosen', () => {
    expect(motivationOf(rect({ label: { en: 'A note' } }))).toContain('commenting');
    expect(motivationOf(rect())).toContain('highlighting');
  });

  it('uses the author’s choice over the inference', () => {
    expect(motivationOf(rect({ label: { en: 'A note' }, motivation: 'describing' })))
      .toContain('describing');
    // …including where it contradicts what the shape would have implied.
    expect(motivationOf(rect({ motivation: 'questioning' }))).toContain('questioning');
  });

  it('keeps the choice out of the way when it is absent', () => {
    expect(rect().motivation).toBeUndefined();
  });
});
