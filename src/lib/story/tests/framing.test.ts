import { describe, expect, it } from 'vitest';
import type { StoryState } from '../../core/types/story';
import {
  DEFAULT_PRESENTATION_ASPECT,
  constrainViewBoxToContent,
  framingsWithin,
  inferPresentationAspect,
  inscribeViewBox,
  isKeyframeEnvelope,
  normaliseStoryFraming,
  normaliseViewBox,
  resolvePresentationAspect,
} from '../framing';
import { framingsDiffer } from '../chapterTasks';

const aspectOf = (box: { w: number; h: number }) => box.w / box.h;
const centreOf = (box: { x: number; y: number; w: number; h: number }) => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});

describe('framing normalisation', () => {
  it('keeps the centre and the visible area', () => {
    const box = { x: 100, y: 200, w: 800, h: 400 };
    const normalised = normaliseViewBox(box, 4 / 3);

    expect(aspectOf(normalised)).toBeCloseTo(4 / 3, 6);
    expect(normalised.w * normalised.h).toBeCloseTo(box.w * box.h, 4);
    expect(centreOf(normalised)).toEqual(centreOf(box));
  });

  it('recovers a framing from the viewport the renderer fitted it into', () => {
    /*
     * `setViewBox` fits, so a framing narrower than the stage comes back
     * padded on one axis. Inscribing is what undoes that — and it is not
     * normalisation, which would keep the padded area and report a zoom the
     * author never applied.
     */
    const framing = { x: 500, y: 531, w: 2404, h: 1803 };
    const stage = 0.8618;
    const viewport = {
      x: framing.x,
      y: framing.y + framing.h / 2 - framing.w / stage / 2,
      w: framing.w,
      h: framing.w / stage,
    };

    const recovered = inscribeViewBox(viewport, 4 / 3);
    expect(recovered.w).toBeCloseTo(framing.w, 3);
    expect(recovered.h).toBeCloseTo(framing.w / (4 / 3), 3);
    expect(centreOf(recovered)).toEqual(centreOf(viewport));
    expect(recovered.w * recovered.h).toBeLessThan(viewport.w * viewport.h);
  });

  it('is a no-op for a box already at the canonical aspect', () => {
    const box = { x: 10, y: 20, w: 400, h: 300 };
    const normalised = normaliseViewBox(box, 4 / 3);

    expect(normalised.x).toBeCloseTo(box.x, 6);
    expect(normalised.y).toBeCloseTo(box.y, 6);
    expect(normalised.w).toBeCloseTo(box.w, 6);
    expect(normalised.h).toBeCloseTo(box.h, 6);
  });

  it('leaves degenerate boxes alone', () => {
    const box = { x: 0, y: 0, w: 0, h: 10 };
    expect(normaliseViewBox(box, 1.5)).toBe(box);
    expect(normaliseViewBox({ x: 0, y: 0, w: 10, h: 10 }, 0)).toEqual({
      x: 0,
      y: 0,
      w: 10,
      h: 10,
    });
  });

  it('infers the aspect authors worked at from their keyframes', () => {
    const story: StoryState = {
      chapters: [
        {
          id: 'a',
          manifest: 'm',
          canvasIndex: 0,
          // A chapter framing that is a camera-path envelope, not a capture.
          viewBox: { x: 0, y: 0, w: 9000, h: 2000 },
          cameraTrack: {
            durationMs: 1000,
            keyframes: [
              { id: '1', timeMs: 0, viewBox: { x: 0, y: 0, w: 1288, h: 1000 } },
              { id: '2', timeMs: 1000, viewBox: { x: 10, y: 0, w: 1288, h: 1000 } },
            ],
          },
        },
        {
          id: 'b',
          manifest: 'm',
          canvasIndex: 0,
          cameraTrack: {
            durationMs: 1000,
            keyframes: [{ id: '3', timeMs: 0, viewBox: { x: 0, y: 0, w: 1370, h: 1000 } }],
          },
        },
      ],
    };

    // The wide envelope must not drag the inferred aspect around.
    expect(inferPresentationAspect(story)).toBeCloseTo(1.288, 3);
  });

  it('prefers an explicit story aspect and falls back when there is nothing to infer', () => {
    expect(resolvePresentationAspect({ presentationAspect: 1.6, chapters: [] })).toBe(1.6);
    expect(resolvePresentationAspect({ chapters: [] })).toBe(DEFAULT_PRESENTATION_ASPECT);
  });

  it('recomputes an envelope chapter framing instead of normalising it', () => {
    const story: StoryState = {
      presentationAspect: 1.5,
      chapters: [
        {
          id: 'motion',
          manifest: 'm',
          canvasIndex: 0,
          // Exactly the bounding box of the keyframes below.
          viewBox: { x: 0, y: 0, w: 2200, h: 1000 },
          cameraTrack: {
            durationMs: 1000,
            keyframes: [
              { id: '1', timeMs: 0, viewBox: { x: 0, y: 0, w: 1200, h: 1000 } },
              { id: '2', timeMs: 1000, viewBox: { x: 1000, y: 0, w: 1200, h: 1000 } },
            ],
          },
        },
      ],
    };
    expect(isKeyframeEnvelope(story.chapters[0])).toBe(true);

    const normalised = normaliseStoryFraming(story);
    const chapter = normalised.chapters[0];
    const keyframes = chapter.cameraTrack!.keyframes;

    for (const keyframe of keyframes) {
      expect(aspectOf(keyframe.viewBox!)).toBeCloseTo(1.5, 6);
    }

    // The chapter framing still spans exactly the normalised camera path.
    const minX = Math.min(...keyframes.map((k) => k.viewBox!.x));
    const maxX = Math.max(...keyframes.map((k) => k.viewBox!.x + k.viewBox!.w));
    expect(chapter.viewBox!.x).toBeCloseTo(minX, 4);
    expect(chapter.viewBox!.w).toBeCloseTo(maxX - minX, 4);
  });

  it('normalises a captured chapter framing that is not an envelope', () => {
    const story: StoryState = {
      presentationAspect: 1.5,
      chapters: [
        {
          id: 'still',
          manifest: 'm',
          canvasIndex: 0,
          viewBox: { x: 0, y: -1000, w: 9987, h: 10453 },
        },
      ],
    };

    const chapter = normaliseStoryFraming(story).chapters[0];
    expect(aspectOf(chapter.viewBox!)).toBeCloseTo(1.5, 6);
    expect(centreOf(chapter.viewBox!)).toEqual(centreOf(story.chapters[0].viewBox!));
  });

  it('brings chapters authored at different stage shapes into agreement', () => {
    const story: StoryState = {
      chapters: [
        {
          id: 'a',
          manifest: 'm',
          canvasIndex: 0,
          cameraTrack: {
            durationMs: 1,
            keyframes: [{ id: '1', timeMs: 0, viewBox: { x: 0, y: 0, w: 1288, h: 1000 } }],
          },
        },
        {
          id: 'b',
          manifest: 'm',
          canvasIndex: 0,
          cameraTrack: {
            durationMs: 1,
            keyframes: [{ id: '2', timeMs: 0, viewBox: { x: 0, y: 0, w: 1690, h: 1000 } }],
          },
        },
      ],
    };

    const normalised = normaliseStoryFraming(story);
    const aspects = normalised.chapters.flatMap((chapter) =>
      (chapter.cameraTrack?.keyframes ?? []).map((k) => aspectOf(k.viewBox!)),
    );
    expect(new Set(aspects.map((a) => a.toFixed(6))).size).toBe(1);
    expect(normalised.presentationAspect).toBeDefined();
  });

  it('is stable when run twice', () => {
    const story: StoryState = {
      chapters: [
        {
          id: 'a',
          manifest: 'm',
          canvasIndex: 0,
          viewBox: { x: 0, y: 0, w: 1690, h: 1000 },
          cameraTrack: {
            durationMs: 1,
            keyframes: [{ id: '1', timeMs: 0, viewBox: { x: 5, y: 5, w: 1288, h: 1000 } }],
          },
        },
      ],
    };

    const once = normaliseStoryFraming(story);
    const twice = normaliseStoryFraming(once);
    expect(twice).toEqual(once);
  });
});

describe('framing comparison', () => {
  it('compares every component against the tolerance', () => {
    const box = { x: 10, y: 20, w: 30, h: 40 };
    expect(framingsWithin({ ...box, x: 10.4 }, box, 0.5)).toBe(true);
    expect(framingsWithin({ ...box, h: 40.4 }, box, 0.5)).toBe(true);
    expect(framingsWithin({ ...box, x: 11 }, box, 0.5)).toBe(false);
    expect(framingsWithin({ ...box, w: 31 }, box, 0.5)).toBe(false);
  });

  it('is inclusive at exactly the tolerance', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    expect(framingsWithin({ ...box, x: 0.5 }, box, 0.5)).toBe(true);
  });

  /*
   * The reason `framingsWithin` and `framingsDiffer` are separate functions
   * rather than one with a tolerance argument. The same absolute shift is
   * imperceptible on a large canvas and a different view entirely on a small
   * crop, so an absolute tolerance cannot answer "did the author reframe".
   * Collapsing the two would silently break drift detection at one end of the
   * scale or the other, and this is what would catch it.
   */
  it('answers differently from drift detection at different canvas scales', () => {
    const shift = 40;

    const large = { x: 0, y: 0, w: 15000, h: 10000 };
    const largeShifted = { ...large, x: large.x + shift };
    expect(framingsWithin(largeShifted, large, 0.5)).toBe(false);
    expect(framingsDiffer(large, largeShifted)).toBe(false);

    const crop = { x: 0, y: 0, w: 300, h: 200 };
    const cropShifted = { ...crop, x: crop.x + shift };
    expect(framingsWithin(cropShifted, crop, 0.5)).toBe(false);
    expect(framingsDiffer(crop, cropShifted)).toBe(true);
  });
});

/*
 * A chapter framed on a stage that is not the canvas's shape used to store the
 * letterbox bars along with the picture. The author saw the image filling the
 * frame; every later reader saw it about a sixth smaller, because the padding
 * was re-fitted on their stage as though it were part of the image. Position
 * looked right — the centre survives — which made it read as a zoom bug with
 * no obvious cause.
 */
describe('constrainViewBoxToContent', () => {
  const canvas = { width: 4032, height: 3024 };

  it('drops letterbox padding from a whole-image capture', () => {
    // A "fit the whole image" view on a portrait stage: 4032 wide, but the
    // viewport runs well above and below the picture.
    const captured = { x: 0, y: -859.97, w: 4032, h: 4743.94 };

    expect(constrainViewBoxToContent(captured, canvas)).toEqual({
      x: 0,
      y: 0,
      w: 4032,
      h: 3024,
    });
  });

  it('keeps a framing that is already a region of the image', () => {
    const inside = { x: 500, y: 531, w: 2404, h: 1803 };
    expect(constrainViewBoxToContent(inside, canvas)).toEqual(inside);
  });

  it('shifts an overhanging framing inside rather than shrinking it', () => {
    // Zoom is the author's decision; only the part that was never picture goes.
    const overhanging = { x: 3500, y: 100, w: 1200, h: 900 };
    const constrained = constrainViewBoxToContent(overhanging, canvas);

    expect(constrained.w).toBe(1200);
    expect(constrained.h).toBe(900);
    expect(constrained.x + constrained.w).toBeLessThanOrEqual(canvas.width);
    expect(constrained.y).toBe(100);
  });

  it('always yields a box a Media Fragment can express', () => {
    const cases = [
      { x: -1000, y: 0, w: 6032, h: 3024 },
      { x: -500, y: -400, w: 5015, h: 3761 },
      { x: 0, y: -859.97, w: 4032, h: 4743.94 },
    ];

    for (const box of cases) {
      const out = constrainViewBoxToContent(box, canvas);
      expect(out.x).toBeGreaterThanOrEqual(0);
      expect(out.y).toBeGreaterThanOrEqual(0);
      expect(out.x + out.w).toBeLessThanOrEqual(canvas.width);
      expect(out.y + out.h).toBeLessThanOrEqual(canvas.height);
    }
  });
});
