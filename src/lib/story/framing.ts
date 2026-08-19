import type { Chapter, StoryState } from '../core/types/story';
import type { ViewBox } from '../core/types/viewer';

/**
 * Camera framings are captured from the viewer's viewport, so every stored box
 * carries the aspect ratio of the stage it was captured on. Within one chapter
 * that is harmless — its keyframes agree with each other — but chapters
 * authored at different window sizes or with different editor panels open end
 * up with different aspects. The renderer fits a box inside the viewport, so a
 * box wider than the viewport binds on width while a taller one binds on
 * height: the apparent zoom then shifts from chapter to chapter for reasons
 * the author never intended.
 *
 * Normalising every stored framing to one canonical aspect removes that.
 * A reader's window still adds padding on whichever axis is looser, but it
 * does so uniformly across the whole story, so the zoom relationships between
 * chapters survive exactly as authored.
 */

/** Used when a story carries no framings to infer an aspect from. */
export const DEFAULT_PRESENTATION_ASPECT = 4 / 3;

/** Relative difference below which two aspects are the same framing. */
const ASPECT_EPSILON = 1e-6;

const isPositive = (value: number | undefined | null): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const viewBoxAspect = (box: ViewBox): number | null =>
  isPositive(box.w) && isPositive(box.h) ? box.w / box.h : null;

/**
 * Rebuilds a framing at `aspect`, keeping its centre and the amount of the
 * image it covers. Preserving area means the author's sense of how far in they
 * were zoomed survives, reframing a little on both axes rather than a lot on
 * one.
 */
export const normaliseViewBox = (box: ViewBox, aspect: number): ViewBox => {
  if (!isPositive(aspect) || !isPositive(box.w) || !isPositive(box.h)) return box;

  // Already canonical. Returning it untouched keeps normalisation idempotent
  // and stops loading a story rewriting framings by a float epsilon.
  if (Math.abs(box.w / box.h - aspect) <= aspect * ASPECT_EPSILON) return box;

  const centreX = box.x + box.w / 2;
  const centreY = box.y + box.h / 2;
  const area = box.w * box.h;
  const width = Math.sqrt(area * aspect);
  const height = width / aspect;

  return {
    x: centreX - width / 2,
    y: centreY - height / 2,
    w: width,
    h: height,
  };
};

/**
 * The largest box of `aspect` that fits inside `box`, on the same centre.
 *
 * The inverse of what the renderer does to show a framing: `setViewBox` calls
 * `fitBounds`, so a chapter framing whose aspect differs from the stage's is
 * displayed with padding on one axis and the viewport that comes back is
 * *larger* than the framing. This recovers the framing from that viewport.
 *
 * Not interchangeable with `normaliseViewBox`, which answers a different
 * question — "what would this view be stored as?" — and preserves area rather
 * than fitting. Between them they cover the two ways a live viewport comes to
 * be related to a stored framing: the author captured it, or the viewer flew
 * to it.
 */
export const inscribeViewBox = (box: ViewBox, aspect: number): ViewBox => {
  if (!isPositive(aspect) || !isPositive(box.w) || !isPositive(box.h)) return box;
  if (Math.abs(box.w / box.h - aspect) <= aspect * ASPECT_EPSILON) return box;

  const width = Math.min(box.w, box.h * aspect);
  const height = width / aspect;
  return {
    x: box.x + box.w / 2 - width / 2,
    y: box.y + box.h / 2 - height / 2,
    w: width,
    h: height,
  };
};

/**
 * Brings a framing inside the canvas.
 *
 * A viewport capture is not a region of the image: when the stage is a
 * different shape from the canvas the viewer letterboxes, and the captured box
 * covers that empty space too — a "whole image" capture on a portrait stage
 * comes back about a quarter wider than the image itself. Storing that padding
 * makes the chapter read as zoomed out to every later reader, because the
 * padding is re-fitted on their stage as though it were picture.
 *
 * It also cannot survive serialisation. Media Fragments `xywh` takes
 * non-negative integers, so the negative origin a letterboxed capture carries
 * is truncated on the way out, which moves the framing as well as inflating it.
 *
 * A box larger than the canvas on an axis is clamped to it; one that merely
 * hangs over an edge is shifted back in, so the author's zoom is kept and only
 * the part that was never picture is dropped.
 */
export const constrainViewBoxToContent = (
  box: ViewBox,
  content: { width: number; height: number },
): ViewBox => {
  if (!isPositive(content.width) || !isPositive(content.height)) return box;
  if (!isPositive(box.w) || !isPositive(box.h)) return box;

  const w = Math.min(box.w, content.width);
  const h = Math.min(box.h, content.height);
  const x = Math.min(Math.max(box.x, 0), content.width - w);
  const y = Math.min(Math.max(box.y, 0), content.height - h);

  return { x, y, w, h };
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

/**
 * Keyframe boxes are the most reliable evidence of the stage an author worked
 * at: each is built from the live viewport, so its aspect is the stage aspect.
 * Chapter framings are a weaker signal — some are viewport captures, others are
 * the bounding envelope of a camera track — so they are only consulted when a
 * story has no keyframes at all.
 */
export const inferPresentationAspect = (story: StoryState): number | null => {
  const keyframeAspects: number[] = [];
  const chapterAspects: number[] = [];

  for (const chapter of story.chapters ?? []) {
    for (const keyframe of chapter.cameraTrack?.keyframes ?? []) {
      const aspect = keyframe.viewBox ? viewBoxAspect(keyframe.viewBox) : null;
      if (aspect !== null) keyframeAspects.push(aspect);
    }
    const chapterAspect = chapter.viewBox ? viewBoxAspect(chapter.viewBox) : null;
    if (chapterAspect !== null) chapterAspects.push(chapterAspect);
  }

  return median(keyframeAspects) ?? median(chapterAspects);
};

/** The aspect every framing in this story should be stored at. */
export const resolvePresentationAspect = (story: StoryState): number => {
  if (isPositive(story.presentationAspect)) return story.presentationAspect;
  return inferPresentationAspect(story) ?? DEFAULT_PRESENTATION_ASPECT;
};

const boundingBox = (boxes: ViewBox[]): ViewBox | null => {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.w));
  const maxY = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/** Bounding box of a chapter's keyframe framings, if it has any. */
const keyframeEnvelope = (chapter: Chapter): ViewBox | null =>
  boundingBox(
    (chapter.cameraTrack?.keyframes ?? [])
      .map((keyframe) => keyframe.viewBox)
      .filter((box): box is ViewBox => Boolean(box)),
  );

/**
 * Component-wise framing comparison within an absolute tolerance.
 *
 * There are three different questions callers ask about a pair of framings,
 * and they are not interchangeable. Reach for the right one rather than
 * adding a fourth:
 *
 * - "Is the viewer effectively already here, so a move can be skipped?"
 *   This function. Mechanical, absolute, and always with an explicit
 *   tolerance — the callers work in image pixels, where the meaning of a
 *   given tolerance depends entirely on how big the image is.
 * - "Has the author meaningfully reframed this chapter?" `framingsDiffer`
 *   in `chapterTasks.ts`, which is relative to the saved box precisely
 *   because an absolute pixel count cannot answer it across canvas sizes.
 * - "Has the stored value changed at all?" An exact identity check, such as
 *   `positionSignature` in `ChapterOverlay.svelte`. No tolerance belongs in
 *   a change-detection key.
 */
export const framingsWithin = (a: ViewBox, b: ViewBox, tolerance: number): boolean =>
  Math.abs(a.x - b.x) <= tolerance &&
  Math.abs(a.y - b.y) <= tolerance &&
  Math.abs(a.w - b.w) <= tolerance &&
  Math.abs(a.h - b.h) <= tolerance;

/**
 * A chapter's own framing means different things depending on how it was
 * written: usually it is a captured viewport, but the builder also derives it
 * as the envelope of a chapter's camera path. An envelope must be recomputed
 * from the normalised keyframes rather than normalised itself, or the chapter
 * would claim to frame a region its camera never visits.
 */
export const isKeyframeEnvelope = (chapter: Chapter): boolean => {
  const envelope = keyframeEnvelope(chapter);
  if (!envelope || !chapter.viewBox) return false;
  const tolerance = Math.max(1, Math.max(envelope.w, envelope.h) * 0.01);
  return framingsWithin(chapter.viewBox, envelope, tolerance);
};

const normaliseChapter = (chapter: Chapter, aspect: number): Chapter => {
  const track = chapter.cameraTrack;
  const wasEnvelope = isKeyframeEnvelope(chapter);

  const nextChapter: Chapter = { ...chapter };

  if (track) {
    nextChapter.cameraTrack = {
      ...track,
      keyframes: track.keyframes.map((keyframe) =>
        keyframe.viewBox
          ? { ...keyframe, viewBox: normaliseViewBox(keyframe.viewBox, aspect) }
          : keyframe,
      ),
    };
  }

  if (chapter.viewBox) {
    nextChapter.viewBox = wasEnvelope
      ? (keyframeEnvelope(nextChapter) ?? normaliseViewBox(chapter.viewBox, aspect))
      : normaliseViewBox(chapter.viewBox, aspect);
  }

  return nextChapter;
};

/**
 * Brings every framing in a story to its canonical aspect. Safe to run
 * repeatedly: normalising an already-normalised box is a no-op.
 */
export const normaliseStoryFraming = (story: StoryState): StoryState => {
  const aspect = resolvePresentationAspect(story);
  if (!isPositive(aspect)) return story;

  return {
    ...story,
    presentationAspect: aspect,
    chapters: (story.chapters ?? []).map((chapter) => normaliseChapter(chapter, aspect)),
  };
};
