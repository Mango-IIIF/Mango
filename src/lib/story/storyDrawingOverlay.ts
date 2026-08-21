/**
 * Reading story drawings back out of the annotations that carry them.
 *
 * The counterpart to `storyDrawingAnnotations.ts`, and the reason the private
 * `mangoState.drawingAnnotations` copy could be dropped. Until this existed the
 * standalone overlay annotations were written for show: a IIIF client could read
 * them, but Mango itself restored every drawing from the extension body, so the
 * published geometry and style were never exercised and nothing caught them
 * drifting. Now they are the only copy, which is also what stops the same
 * drawing being reconciled from two places — the shape item 1 of the authoring
 * ticket took.
 *
 * Everything here is a lossless inverse of what the writer emits, with one
 * deliberate asymmetry: a value that matches the writer's default is read back
 * as absent. A stylesheet always spells out colour, width and fill, so without
 * that a drawing whose author chose none of them would return from a round trip
 * carrying all three.
 */

import type { ChapterDrawingAnnotation } from '../core/types/story';
import {
  ANNOTATION_STROKE_WIDTH_PX,
  CHAPTER_ANNOTATION_MOTIVATIONS,
  type ChapterAnnotationMotivation,
  type ChapterAnnotationStrokeWidth,
} from '../core/types/story';
import { resolveAnnotationJson } from '../features/annotations/canonical';
import type { ResolvedAnnotation } from '../iiif/annotationResolver';
import {
  DEFAULT_DRAWING_COLOR,
  DEFAULT_DRAWING_FILL_MODE,
  DEFAULT_DRAWING_STROKE_WIDTH,
  DRAWING_TRANSPARENT_FILL_ALPHA,
} from './storyDrawingAnnotations';
import { rgbaFromHex } from '../features/annotations/style';

/** Path segment marking an overlay annotation as a drawing rather than a caption. */
export const DRAWING_OVERLAY_SEGMENT = '/overlay/drawing/';

/** Whether an overlay id names a drawing belonging to a given chapter annotation. */
export const isDrawingOverlayId = (
  overlayId: string | undefined,
  chapterAnnotationId: string | undefined,
): boolean =>
  Boolean(
    overlayId &&
      chapterAnnotationId &&
      overlayId.startsWith(`${chapterAnnotationId}${DRAWING_OVERLAY_SEGMENT}`),
  );

const drawingIdFromOverlayId = (
  overlayId: string,
  chapterAnnotationId: string | undefined,
): string => {
  const prefix = `${chapterAnnotationId}${DRAWING_OVERLAY_SEGMENT}`;
  const encoded = isDrawingOverlayId(overlayId, chapterAnnotationId)
    ? overlayId.slice(prefix.length)
    : overlayId;
  try {
    return decodeURIComponent(encoded);
  } catch {
    // A malformed escape is still a usable identity; refusing the drawing over
    // it would lose the annotation entirely.
    return encoded;
  }
};

const DRAWING_TYPE_BY_SHAPE: Record<string, ChapterDrawingAnnotation['type']> = {
  rect: 'rectangle',
  point: 'point',
  polygon: 'polygon',
  freehand: 'freehand',
  line: 'line',
};

/**
 * Geometry in the compact form story state stores.
 *
 * `shapeType` decides, never the populated slot: polygon, freehand and line all
 * arrive as a point list, and only the declared type says whether the last point
 * joins the first.
 */
const geometryOf = (
  resolved: ResolvedAnnotation,
  type: ChapterDrawingAnnotation['type'],
): Pick<ChapterDrawingAnnotation, 'rect' | 'point' | 'points'> | null => {
  if (type === 'rectangle') return resolved.rect ? { rect: resolved.rect } : null;
  if (type === 'point') return resolved.point ? { point: resolved.point } : null;
  const points = resolved.polygon?.points ?? [];
  const minimum = type === 'polygon' ? 3 : 2;
  return points.length >= minimum ? { points: points.map(({ x, y }) => ({ x, y })) } : null;
};

/** The bucket whose pixel width the stylesheet declared, if any did. */
const strokeWidthBucket = (
  width: number | undefined,
): ChapterAnnotationStrokeWidth | undefined => {
  if (width === undefined || !Number.isFinite(width)) return undefined;
  const entries = Object.entries(ANNOTATION_STROKE_WIDTH_PX) as Array<
    [ChapterAnnotationStrokeWidth, number]
  >;
  return entries.reduce<[ChapterAnnotationStrokeWidth, number]>(
    (closest, entry) =>
      Math.abs(entry[1] - width) < Math.abs(closest[1] - width) ? entry : closest,
    entries[0],
  )[0];
};

/**
 * Per-language captions, from the annotation's own textual bodies.
 *
 * Keyed by the body's declared language rather than by a display preference:
 * this is the persistence form, and collapsing translations to whichever one a
 * reader prefers is how the other languages get dropped on the next save.
 */
const labelsOf = (resolved: ResolvedAnnotation): Record<string, string> => {
  const label: Record<string, string> = {};
  for (const body of resolved.bodies ?? []) {
    if (body.type !== 'text' && body.type !== 'html') continue;
    const value = body.value?.trim();
    if (!value) continue;
    const language = body.language || 'en';
    if (!label[language]) label[language] = value;
  }
  return label;
};

const isChapterMotivation = (value: string): value is ChapterAnnotationMotivation =>
  (CHAPTER_ANNOTATION_MOTIVATIONS as readonly string[]).includes(value);

/**
 * Turns one exported overlay annotation back into a story drawing.
 *
 * Parsing goes through the canonical parser rather than reading the JSON
 * directly, so a `FragmentSelector`, an `SvgSelector` and a `PointSelector` are
 * all understood, and so is a document some other client wrote in a shape Mango
 * does not emit.
 */
export const parseStoryDrawingOverlay = (
  overlay: unknown,
  options: { canvasId?: string; chapterAnnotationId?: string } = {},
): ChapterDrawingAnnotation | null => {
  const { annotation } = resolveAnnotationJson(overlay, {
    provenance: 'local',
    ...(options.canvasId ? { canvasId: options.canvasId } : {}),
  });
  if (!annotation?.shapeType) return null;
  const type = DRAWING_TYPE_BY_SHAPE[annotation.shapeType];
  if (!type) return null;
  const geometry = geometryOf(annotation, type);
  if (!geometry) return null;

  const overlayId =
    (typeof overlay === 'object' && overlay !== null
      ? (overlay as { id?: unknown }).id
      : undefined) ?? annotation.id;
  const id = drawingIdFromOverlayId(String(overlayId), options.chapterAnnotationId);

  const label = labelsOf(annotation);
  const hasLabel = Object.keys(label).length > 0;

  const strokeColor = annotation.styleHints?.strokeColor?.trim();
  const color =
    strokeColor && strokeColor.toLowerCase() !== DEFAULT_DRAWING_COLOR ? strokeColor : undefined;

  const strokeWidth = strokeWidthBucket(annotation.styleHints?.strokeWidth);

  /*
   * Fill says which of the two modes the writer chose: solid repeats the stroke
   * colour exactly, transparent is the same colour at a fixed alpha. Comparing
   * against both spellings rather than sniffing for `rgba(` keeps a document
   * that names its fill some other way from being read as solid.
   */
  const fillColor = annotation.styleHints?.fillColor?.trim();
  const paintColor = strokeColor ?? DEFAULT_DRAWING_COLOR;
  const fillMode = !fillColor
    ? undefined
    : fillColor.toLowerCase() === paintColor.toLowerCase()
      ? 'solid'
      : fillColor === rgbaFromHex(paintColor, DRAWING_TRANSPARENT_FILL_ALPHA)
        ? 'transparent'
        : undefined;

  /*
   * Absent means "let the export decide", and the export decides by looking for
   * words on the shape. Recording a motivation that agrees with that inference
   * would turn an author who never chose one into an author who did — and then
   * a caption they later delete would leave `commenting` behind.
   */
  const declared = (annotation.motivation ?? []).find(isChapterMotivation);
  const inferred = hasLabel ? 'commenting' : 'highlighting';
  const motivation = declared && declared !== inferred ? declared : undefined;

  return {
    id,
    type,
    ...(hasLabel ? { label } : {}),
    ...(color ? { color } : {}),
    ...(strokeWidth && strokeWidth !== DEFAULT_DRAWING_STROKE_WIDTH ? { strokeWidth } : {}),
    ...(fillMode && fillMode !== DEFAULT_DRAWING_FILL_MODE ? { fillMode } : {}),
    ...(motivation ? { motivation } : {}),
    ...geometry,
  };
};
