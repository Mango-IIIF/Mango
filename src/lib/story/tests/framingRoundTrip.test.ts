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
    const stateBody = exported.items[0].body as {
      mangoState: Record<string, unknown>;
    };
    expect(stateBody.mangoState.presentationAspect).toBeUndefined();

    const reloaded = normaliseStoryInput(exported);
    expect(reloaded.ok).toBe(true);
    // The wire carries integer xywh rather than a second private aspect value,
    // so reconstruction is stable to the exported pixel boundary.
    expect(reloaded.story!.presentationAspect).toBeCloseTo(aspect, 3);

    // The reloaded story resolves to the same aspect rather than re-inferring
    // one from its own (already normalised) boxes.
    expect(resolvePresentationAspect(reloaded.story!)).toBeCloseTo(aspect, 3);
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
    const body = exported.items[0].body as { mangoState: Record<string, unknown> };
    expect(body.mangoState.presentationAspect).toBeUndefined();
  });
});

describe('the frame lock', () => {
  /*
   * In the builder every framing is a frame on the canvas held to the story's
   * aspect, so what reaches the serializer is already canonical — and what
   * comes back from a save cycle must be too, for the chapter frame and for
   * every keyframe, or the lock would be undone by the very act of saving.
   */
  it('keeps chapter and keyframe frames at the presentation aspect through a save cycle', () => {
    const locked: StoryState = {
      presentationAspect: 16 / 9,
      chapters: [
        {
          id: 'chapter_1',
          manifest: 'https://example.org/manifest.json',
          canvasIndex: 0,
          canvasId: 'https://example.org/canvas/0',
          viewBox: { x: 120, y: 80, w: 1600, h: 900 },
          cameraTrack: {
            durationMs: 5000,
            preset: 'custom',
            keyframes: [
              {
                id: 'a',
                timeMs: 0,
                focus: { x: 920, y: 530 },
                viewBox: { x: 120, y: 80, w: 1600, h: 900 },
              },
              {
                id: 'b',
                timeMs: 5000,
                focus: { x: 1000, y: 600 },
                viewBox: { x: 600, y: 375, w: 800, h: 450 },
              },
            ],
          },
        },
      ],
    };

    const exported = serializeStoryToIiif(normaliseStoryFraming(locked));
    const reloaded = normaliseStoryInput(exported).story!;

    expect(reloaded.presentationAspect).toBeCloseTo(16 / 9, 9);
    const boxes = reloaded.chapters.flatMap((chapter) => [
      chapter.viewBox!,
      ...(chapter.cameraTrack?.keyframes ?? []).map((point) => point.viewBox!),
    ]);
    expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      // Integer xywh on the wire, so a pixel of slack is the most this allows.
      expect(Math.abs(box.w / box.h - 16 / 9)).toBeLessThan(0.002);
    }
    // Nothing was moved by the round trip either.
    expect(reloaded.chapters[0].viewBox).toMatchObject({ x: 120, y: 80, w: 1600, h: 900 });
  });
});
