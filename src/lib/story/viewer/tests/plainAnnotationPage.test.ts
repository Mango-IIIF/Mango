import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normaliseStoryInput } from '../storyLoader';

const fixture = () =>
  JSON.parse(
    readFileSync(resolve(__dirname, '../../../../../apps/demo/interop/gottingen-story.json'), 'utf8'),
  );

describe('a plain AnnotationPage read as a story', () => {
  it('accepts a page with no Mango vocabulary at all', () => {
    const raw = fixture();
    expect(JSON.stringify(raw).includes('mango')).toBe(false);

    const result = normaliseStoryInput(raw);
    expect(result.ok).toBe(true);
  });

  it('makes one chapter per annotation, in document order', () => {
    const result: any = normaliseStoryInput(fixture());
    expect(result.story.chapters).toHaveLength(6);
    expect(result.story.chapters.map((c: any) => c.title?.en)).toEqual([
      'The Gänseliesel',
      'The fountain canopy',
      'A pride flag',
      'The café sign',
      'A dog on the paving',
      'The town hall gable',
    ]);
  });

  it('takes the framing from the target selector', () => {
    const result: any = normaliseStoryInput(fixture());
    const statue = result.story.chapters[0];
    expect(statue.viewBox).toBeDefined();
    // Framings are normalised to one presentation aspect on the way in, which
    // preserves centre and area rather than the literal edges.
    const centre = (b: any) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    expect(centre(statue.viewBox).x).toBeCloseTo(900 + 260 / 2, 0);
    expect(centre(statue.viewBox).y).toBeCloseTo(1150 + 420 / 2, 0);
  });

  it('takes the caption from a textual body when there is no summary', () => {
    const result: any = normaliseStoryInput(fixture());
    expect(result.story.chapters[2].description?.en).toBe('Chapter 3 description');
  });

  it('resolves the manifest from the target partOf', () => {
    const result: any = normaliseStoryInput(fixture());
    for (const chapter of result.story.chapters) {
      expect(chapter.manifest).toBe(
        'https://iiif.io/api/cookbook/recipe/0005-image-service/manifest.json',
      );
    }
  });

  /*
   * Previously asserted the opposite. That came out of a fix for Mango
   * inventing a rectangle for a chapter's caption body, which has no
   * geometry of its own — but an annotation on a foreign page does have a
   * real target region, and drawing it is showing what the document says
   * rather than fabricating something. It is what every annotation viewer
   * does with the same file.
   */
  it('draws every annotation region, as well as framing it', () => {
    const result: any = normaliseStoryInput(fixture());
    expect(result.story.chapters).toHaveLength(6);
    for (const chapter of result.story.chapters) {
      const drawings = chapter.drawingAnnotations ?? [];
      expect(drawings).toHaveLength(1);
      expect(['rectangle', 'polygon']).toContain(drawings[0].type);
      // No in-region text: these captions are paragraphs.
      expect(drawings[0].label).toBeUndefined();
    }
  });

  /*
   * The drawn region is what the document says; the framing is a
   * presentation adjustment on top of it. Normalising every chapter to one
   * aspect keeps the story's zoom consistent, so the two legitimately
   * differ — the box must stay on the annotation's real region rather than
   * following the camera.
   */
  it('draws the target region itself, not the normalised framing', () => {
    const result: any = normaliseStoryInput(fixture());
    const statue = result.story.chapters[0];

    expect(statue.drawingAnnotations[0].rect).toEqual({
      x: 900, y: 1150, w: 260, h: 420,
    });
    expect(statue.viewBox).not.toEqual(statue.drawingAnnotations[0].rect);
  });

  /*
   * An SvgSelector says the region is not a rectangle. The shape is kept so
   * it can be drawn as the document meant it, while the framing falls back to
   * its bounding box, because a camera can only be given a rectangle.
   */
  it('draws a non-rectangular region as the polygon it is', () => {
    const result: any = normaliseStoryInput(fixture());
    const canopy = result.story.chapters[1].drawingAnnotations[0];

    expect(canopy.type).toBe('polygon');
    expect(canopy.points).toHaveLength(6);
    expect(canopy.points[0]).toEqual({ x: 1075, y: 880 });
    expect(result.story.chapters[1].viewBox).toBeDefined();
  });
});
