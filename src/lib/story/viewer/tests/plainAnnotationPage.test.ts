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
      'The market square',
      'The Altes Rathaus',
      'The Gänseliesel fountain',
      'Flags and café tables',
      'Half-timbered corner',
      'The paving',
    ]);
  });

  it('takes the framing from the target selector', () => {
    const result: any = normaliseStoryInput(fixture());
    const fountain = result.story.chapters[2];
    expect(fountain.viewBox).toBeDefined();
    // Framings are normalised to one presentation aspect on the way in, which
    // preserves centre and area rather than the literal edges.
    const centre = (b: any) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    expect(centre(fountain.viewBox).x).toBeCloseTo(700 + 600 / 2, 0);
    expect(centre(fountain.viewBox).y).toBeCloseTo(850 + 1150 / 2, 0);
  });

  it('takes the caption from a textual body when there is no summary', () => {
    const result: any = normaliseStoryInput(fixture());
    expect(result.story.chapters[2].description?.en).toContain('Gänseliesel');
  });

  it('resolves the manifest from the target partOf', () => {
    const result: any = normaliseStoryInput(fixture());
    for (const chapter of result.story.chapters) {
      expect(chapter.manifest).toBe(
        'https://iiif.io/api/cookbook/recipe/0005-image-service/manifest.json',
      );
    }
  });

  it('invents no overlay annotations', () => {
    const result: any = normaliseStoryInput(fixture());
    for (const chapter of result.story.chapters) {
      expect(chapter.drawingAnnotations ?? []).toHaveLength(0);
    }
  });
});
