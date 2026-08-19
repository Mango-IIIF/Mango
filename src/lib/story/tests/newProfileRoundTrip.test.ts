import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normaliseStoryInput } from '../viewer/storyLoader';
import { serializeStoryToIiif } from '../storySerializer';
import { MANGO_STORY_CONTEXT_URL } from '../storyAnnotationProfile';
import { setLocale } from '../../core/i18n';
import type { StoryState } from '../../core/types/story';
import chapter6Fixture from './fixtures/chapter-6-multilingual-story.json';

const demo = () =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../../apps/demo/test-story/demo.json'), 'utf8'));

const load = (page: unknown) => {
  const result = normaliseStoryInput(page) as any;
  expect(result.ok).toBe(true);
  return result.story;
};

/**
 * A page carrying drawings, which `demo.json` does not.
 *
 * The round trip below was blind to the bug it was written to catch precisely
 * because its fixture had none: every one of its 17 items is a plain chapter,
 * so a defect that duplicates drawings had nothing to duplicate.
 */
const DRAWING_STORY_ID = 'https://example.org/story/chapter-6';
const drawingPage = () =>
  serializeStoryToIiif(chapter6Fixture as StoryState, { id: DRAWING_STORY_ID });

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

  it('writes state as a typed data body rather than prose', () => {
    const saved: any = serializeStoryToIiif(load(demo()));
    const bodies = saved.items.flatMap((i: any) => (Array.isArray(i.body) ? i.body : [i.body]));
    const state = bodies.filter((b: any) => b?.format?.includes('mango'));

    expect(state.length).toBeGreaterThan(0);
    for (const body of state) {
      // A single string, not an array: IIIF allows one type per resource,
      // and its validator rejects the W3C multi-type form.
      expect(body.type).toBe('mango:ViewerState');
      // A viewer that renders every TextualBody it finds must not be handed
      // a wall of JSON where a caption belongs.
      expect(body.type).not.toBe('TextualBody');
      expect(typeof body.mangoState).toBe('object');
    }
  });

  it('gives every state body an id under its own annotation', () => {
    const saved: any = serializeStoryToIiif(load(demo()), { id: demo().id });
    const stated = saved.items.filter((i: any) => i.body?.mangoState);

    expect(stated.length).toBeGreaterThan(0);
    for (const annotation of stated) {
      // IIIF requires an http(s) id on any body that is not a TextualBody.
      expect(annotation.body.id).toBe(`${annotation.id}/state`);
      expect(annotation.body.id).toMatch(/^https?:\/\//);
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

describe('drawings survive repeated saves', () => {
  /** Every drawing on the first chapter, in the form worth comparing. */
  const drawingsOf = (story: any) =>
    (story.chapters[0].drawingAnnotations ?? []).map((drawing: any) => ({
      id: drawing.id,
      type: drawing.type,
      label: drawing.label,
      rect: drawing.rect,
      point: drawing.point,
      points: drawing.points,
    }));

  /*
   * Three cycles, not two. An earlier reading of this defect had it adding one
   * phantom and then settling, which a two-cycle test would have signed off;
   * what it actually did was add one more on every cycle, for ever.
   */
  it('keeps the same drawings across three save/load cycles', () => {
    const cycles: any[] = [];
    let page: unknown = drawingPage();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const story = load(page);
      cycles.push(drawingsOf(story));
      page = serializeStoryToIiif(story, { id: DRAWING_STORY_ID });
    }

    const authored = chapter6Fixture.chapters[0].drawingAnnotations;
    expect(cycles[0]).toHaveLength(authored.length);
    expect(cycles[0].map((drawing: any) => drawing.id)).toEqual(
      authored.map((drawing) => drawing.id),
    );
    expect(cycles[1]).toEqual(cycles[0]);
    expect(cycles[2]).toEqual(cycles[0]);
  });

  it('carries geometry, caption and appearance on the IIIF annotation itself', () => {
    const story = load(drawingPage());
    const captioned = story.chapters[0].drawingAnnotations.find(
      (drawing: any) => drawing.id === 'chapter_6-annotation',
    );

    expect(captioned).toMatchObject({
      type: 'rectangle',
      rect: { x: 4500, y: 6500, w: 800, h: 300 },
      label: {
        en: 'Annotations appear in context.',
        cy: 'Mae anodiadau yn ymddangos yn eu cyd-destun.',
      },
      strokeWidth: 'thick',
      fillMode: 'solid',
    });

    // Read from `items`, not from the extension body — which no longer has it.
    const page: any = drawingPage();
    const state = page.items[0].body.mangoState;
    expect(state.drawingAnnotations).toBeUndefined();
    expect(state.viewBox).toBeUndefined();
  });

  it('does not invent a caption rectangle from a drawing’s own text', () => {
    /*
     * The phantom wore a real drawing's caption over an unrelated part of the
     * image, at the default text-box placement resolved against the chapter
     * framing. Nothing should land there.
     */
    const story = load(drawingPage());
    const framing = story.chapters[0].viewBox;
    const defaultPlacement = {
      x: framing.x + 0.33 * framing.w,
      y: framing.y + 0.33 * framing.h,
    };

    for (const drawing of story.chapters[0].drawingAnnotations) {
      expect(drawing.rect?.x).not.toBeCloseTo(defaultPlacement.x, 0);
      expect(drawing.id).not.toMatch(/-annotation-\d+$/);
    }
  });
});

describe('an untitled story stays untitled', () => {
  const untitled: StoryState = {
    chapters: [
      {
        id: 'chapter_1',
        manifest: 'https://example.org/manifest',
        canvasIndex: 0,
        canvasId: 'https://example.org/canvas/1',
        viewBox: { x: 0, y: 0, w: 400, h: 300 },
      },
    ],
  };

  it('writes no label rather than a display placeholder', () => {
    const page: any = serializeStoryToIiif(untitled);
    expect(page.label).toBeUndefined();
    expect(load(page).title).toBeUndefined();
  });

  /*
   * The placeholder came from the UI catalogue, so the title a story came back
   * with depended on the language its author happened to be working in — the
   * same story, exported twice, with two different titles.
   */
  it('comes back the same whatever language the editor was in', () => {
    const titles = ['en', 'fr'].map((language) => {
      setLocale(language);
      return load(serializeStoryToIiif(untitled)).title;
    });
    setLocale('en');

    expect(titles[0]).toBeUndefined();
    expect(titles[1]).toEqual(titles[0]);
  });

  it('still round-trips a title the author did give it', () => {
    const page = serializeStoryToIiif({ ...untitled, title: { en: 'A real title' } });
    expect(load(page).title).toEqual({ en: 'A real title' });
  });

  it('omits an empty language entry instead of writing a blank string', () => {
    const page: any = serializeStoryToIiif({
      ...untitled,
      title: { en: '', cy: 'Teitl' },
      chapters: [{ ...untitled.chapters[0], title: { en: '' }, description: { en: '  ' } }],
    });

    expect(page.label).toEqual({ cy: ['Teitl'] });
    expect(page.items[0].label).toBeUndefined();
    expect(page.items[0].summary).toBeUndefined();
  });
});
