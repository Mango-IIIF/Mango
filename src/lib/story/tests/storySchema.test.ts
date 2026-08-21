import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { serializeStoryToIiif } from '../storySerializer';
import { normaliseStoryInput } from '../viewer/storyLoader';
import type { StoryState } from '../../core/types/story';
import chapter6Fixture from './fixtures/chapter-6-multilingual-story.json';

/*
 * `schemas/story-annotation-page.schema.json` is published as the normative
 * profile, and nothing was checking output against it — which is how the
 * document came to describe only text overlays while the serializer had been
 * writing drawing overlays for months. Enforcing it here is the difference
 * between a schema and a document about a schema.
 */
const schema = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../schemas/story-annotation-page.schema.json'), 'utf8'),
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const errorsFor = (page: unknown): string[] => {
  if (validate(page)) return [];
  return (validate.errors ?? []).map(
    (error) => `${error.instancePath || '/'} ${error.message ?? ''}`.trim(),
  );
};

const PAGE_ID = 'https://museum.example/stories/object-42/chapters';

const richStory: StoryState = {
  id: PAGE_ID,
  title: { en: 'Object 42 highlights' },
  narration: { tracks: { en: { src: 'https://museum.example/audio/en.mp3' } } },
  chapters: [
    {
      ...(chapter6Fixture.chapters[0] as StoryState['chapters'][number]),
      title: { en: 'Examine the inscription' },
      description: { en: 'The maker’s mark sits under the rim.' },
      narrationSegment: { en: { start: 0, end: 12 } },
      annotations: { en: { text: 'A caption', placement: { x: 4400, y: 6400, w: 500, h: 200 } } },
      advance: { mode: 'auto', delayMs: 4000 },
      entryTransition: { type: 'tween', durationMs: 900, easing: 'ease-in-out' },
      layerOpacities: { 'https://museum.example/iiif/object-42/annotation/infrared': 0.65 },
      cameraTrack: {
        durationMs: 6000,
        preset: 'pan',
        keyframes: [
          { id: 'a', timeMs: 0, viewBox: { x: 4333, y: 6393, w: 2494, h: 1245 } },
          { id: 'b', timeMs: 6000, focus: { x: 5000, y: 6800 } },
        ],
      },
    },
  ],
};

describe('the published schema describes what Mango writes', () => {
  it('validates a story carrying every kind of item', () => {
    const page = serializeStoryToIiif(richStory, { id: PAGE_ID });

    // Chapter, one text overlay, five drawings.
    expect(page.items).toHaveLength(7);
    expect(errorsFor(page)).toEqual([]);
  });

  it('validates the story again after a full save/load cycle', () => {
    const once = serializeStoryToIiif(richStory, { id: PAGE_ID });
    const reloaded = normaliseStoryInput(once);
    expect(reloaded.ok).toBe(true);

    expect(errorsFor(serializeStoryToIiif(reloaded.story!, { id: PAGE_ID }))).toEqual([]);
  });

  it('validates a legacy story once it has been migrated through a save', () => {
    // The stories already in user stores are the ones a stale schema failed to
    // describe, so re-saving one has to land on the current profile exactly.
    const legacy = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../../../apps/demo/test-story/demo.json'),
        'utf8',
      ),
    );
    const migrated = normaliseStoryInput(legacy);
    expect(migrated.ok).toBe(true);

    expect(errorsFor(serializeStoryToIiif(migrated.story!, { id: legacy.id }))).toEqual([]);
  });

  it('validates an untitled story with a single bare chapter', () => {
    const page = serializeStoryToIiif(
      {
        chapters: [
          {
            id: 'only',
            manifest: 'https://museum.example/iiif/object-42/manifest',
            canvasIndex: 0,
            canvasId: 'https://museum.example/iiif/object-42/canvas/1',
            viewBox: { x: 0, y: 0, w: 400, h: 300 },
          },
        ],
      },
      { id: PAGE_ID },
    );

    expect(page.label).toBeUndefined();
    expect(errorsFor(page)).toEqual([]);
  });

  /*
   * Two different questions, deliberately answered in two different places.
   * This schema asks whether the document is structurally IIIF, and a story
   * with no publishing identifier still gets a generated HTTP(S) one, so the
   * answer is yes. Whether that identifier is one you should publish is
   * `validatePublicationIdentifiers`' job — see publicIdentifiers.test.ts.
   * Answering it here instead would mean a draft is unreadable as IIIF, which
   * helps nobody and is what the `urn:` placeholder used to cost.
   */
  it('accepts a draft export, whose identifiers are generated but valid', () => {
    const draft = serializeStoryToIiif({ ...richStory, id: undefined });

    expect(draft.id).toMatch(/^https:\/\/mangoviewer\.dev\/stories\/draft\//);
    expect(errorsFor(draft)).toEqual([]);
  });

  it('refuses a fractional xywh rectangle', () => {
    const page: any = serializeStoryToIiif(richStory, { id: PAGE_ID });
    const drawing = page.items.find((item: any) => item.id.includes('/overlay/drawing/'));
    drawing.target.selector.value = 'xywh=623.4913,320.7742,893.2777,795.99';

    expect(errorsFor(page).length).toBeGreaterThan(0);
  });

  it('refuses an empty language-map entry', () => {
    const page: any = serializeStoryToIiif(richStory, { id: PAGE_ID });
    page.label = { en: [''] };

    expect(errorsFor(page).length).toBeGreaterThan(0);
  });
});
