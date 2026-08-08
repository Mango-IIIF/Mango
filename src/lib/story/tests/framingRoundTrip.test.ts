import { describe, expect, it } from 'vitest';
import type { StoryState } from '../../core/types/story';
import { serializeStoryToIiif } from '../storySerializer';
import { normaliseStoryInput } from '../viewer/storyLoader';
import { normaliseStoryFraming, resolvePresentationAspect } from '../framing';

const story: StoryState = {
  chapters: [
    {
      id: 'chapter_1',
      manifest: 'https://example.org/manifest.json',
      canvasIndex: 0,
      canvasId: 'https://example.org/canvas/0',
      // Captured on a 1.69 stage.
      viewBox: { x: 100, y: 100, w: 1690, h: 1000 },
    },
    {
      id: 'chapter_2',
      manifest: 'https://example.org/manifest.json',
      canvasIndex: 0,
      canvasId: 'https://example.org/canvas/0',
      // Captured on a 1.288 stage.
      viewBox: { x: 500, y: 200, w: 1288, h: 1000 },
    },
  ],
};

describe('presentation aspect round trip', () => {
  it('survives export and reload so normalisation stays reproducible', () => {
    const normalised = normaliseStoryFraming(story);
    const aspect = normalised.presentationAspect!;
    expect(aspect).toBeGreaterThan(0);

    const exported = serializeStoryToIiif(normalised);

    const reloaded = normaliseStoryInput(exported);
    expect(reloaded.ok).toBe(true);
    expect(reloaded.story!.presentationAspect).toBeCloseTo(aspect, 9);

    // The reloaded story resolves to the same aspect rather than re-inferring
    // one from its own (already normalised) boxes.
    expect(resolvePresentationAspect(reloaded.story!)).toBeCloseTo(aspect, 9);
  });

  it('brings differently-shaped chapters into agreement through a save cycle', () => {
    const exported = serializeStoryToIiif(normaliseStoryFraming(story));
    const reloaded = normaliseStoryInput(exported).story!;

    const aspects = reloaded.chapters.map((chapter) => chapter.viewBox!.w / chapter.viewBox!.h);
    expect(aspects[0]).toBeCloseTo(aspects[1], 6);
  });

  it('exports the normalised framing as the IIIF xywh fragment', () => {
    const normalised = normaliseStoryFraming(story);
    const exported = serializeStoryToIiif(normalised);
    const target = exported.items[0].target as {
      selector: { value: string };
    };

    const framing = normalised.chapters[0].viewBox!;
    const expected = `xywh=${Math.round(framing.x)},${Math.round(framing.y)},${Math.round(framing.w)},${Math.round(framing.h)}`;
    expect(target.selector.value).toBe(expected);
  });

  it('leaves a story with no framings without an aspect claim', () => {
    const exported = serializeStoryToIiif({
      chapters: [
        {
          id: 'audio_only',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          media: { start: 0, end: 5 },
        },
      ],
    });
    const body = exported.items[0].body as { value: string };
    expect(JSON.parse(body.value).state.presentationAspect).toBeUndefined();
  });
});
