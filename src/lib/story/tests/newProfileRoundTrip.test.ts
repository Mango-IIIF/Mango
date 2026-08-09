import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normaliseStoryInput } from '../viewer/storyLoader';
import { serializeStoryToIiif } from '../storySerializer';
import { MANGO_STORY_CONTEXT_URL } from '../storyAnnotationProfile';

const demo = () =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../../apps/demo/test-story/demo.json'), 'utf8'));

const load = (page: unknown) => {
  const result = normaliseStoryInput(page) as any;
  expect(result.ok).toBe(true);
  return result.story;
};

describe('the migrated profile survives a save', () => {
  /*
   * The point of the migration: a story that has been converted must not be
   * quietly converted back the first time somebody opens and saves it.
   */
  it('re-serialises a migrated story to the same shape it was loaded from', () => {
    const before = demo();
    const saved: any = serializeStoryToIiif(load(before), { id: before.id });

    expect(saved['@context']).toEqual([
      'http://www.w3.org/ns/anno.jsonld',
      MANGO_STORY_CONTEXT_URL,
      'http://iiif.io/api/presentation/3/context.json',
    ]);
    expect(JSON.stringify(saved)).not.toContain('storyVersion');
    expect(JSON.stringify(saved)).not.toContain('mango-iiif.github.io');
  });

  it('writes state as a dataset body rather than prose', () => {
    const saved: any = serializeStoryToIiif(load(demo()));
    const bodies = saved.items.flatMap((i: any) => (Array.isArray(i.body) ? i.body : [i.body]));
    const state = bodies.filter((b: any) => b?.format?.includes('mango'));

    expect(state.length).toBeGreaterThan(0);
    for (const body of state) {
      expect(body.type).toEqual(['Dataset', 'mango:ViewerState']);
      // A viewer that renders every TextualBody it finds must not be handed
      // a wall of JSON where a caption belongs.
      expect(body.type).not.toContain('TextualBody');
      expect(typeof body.mangoState).toBe('object');
    }
  });

  it('keeps the story identical across load, save and load again', () => {
    const once = load(demo());
    const twice = load(serializeStoryToIiif(once, { id: demo().id }));

    expect(twice.chapters).toHaveLength(once.chapters.length);
    expect(twice.chapters.map((c: any) => c.title)).toEqual(
      once.chapters.map((c: any) => c.title),
    );
    expect(twice.chapters.map((c: any) => c.viewBox)).toEqual(
      once.chapters.map((c: any) => c.viewBox),
    );
    expect(twice.chapters.map((c: any) => c.manifest)).toEqual(
      once.chapters.map((c: any) => c.manifest),
    );
    expect(twice.chapters.map((c: any) => c.canvasIndex)).toEqual(
      once.chapters.map((c: any) => c.canvasIndex),
    );
    expect(twice.chapters.map((c: any) => c.cameraTrack)).toEqual(
      once.chapters.map((c: any) => c.cameraTrack),
    );
    expect(twice.narration).toEqual(once.narration);
  });
});
