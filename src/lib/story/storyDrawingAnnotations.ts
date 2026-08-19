import type { CanonicalAnnotation, NeutralShape, RectGeometry } from '@mango-iiif/w3c-parser';
import {
  ANNOTATION_STROKE_WIDTH_PX,
  type AnnotationPlacement,
  type ChapterAnnotationFillMode,
  type ChapterAnnotationStrokeWidth,
  type ChapterDrawingAnnotation,
} from '../core/types/story';
import type { ResolvedAnnotation } from '../iiif/annotationResolver';
import { createMangoAnnotation, projectToResolved } from '../features/annotations/canonical';
import {
  buildAnnotationStylesheet,
  rgbaFromHex,
  safeAnnotationColor,
  styleClassForLayer,
} from '../features/annotations/style';

/**
 * Whole pixels for the one shape that becomes a media fragment.
 *
 * A rectangle serialises to `xywh=`, and Media Fragments URI 1.0 defines those
 * values as integers — so a fractional rectangle is invalid as written, and the
 * selector cannot be the authoritative copy of a geometry it cannot express.
 * Rounding here rather than at the selector keeps what Mango draws and what it
 * publishes the same rectangle. The other shapes serialise to `SvgSelector` or
 * `PointSelector`, where floats are valid, and are deliberately left alone.
 */
const wholePixelRect = (rect: AnnotationPlacement): RectGeometry => ({
  x: Math.max(0, Math.round(rect.x)),
  y: Math.max(0, Math.round(rect.y)),
  w: Math.max(1, Math.round(rect.w)),
  h: Math.max(1, Math.round(rect.h)),
});

/**
 * Appearance a drawing has when it has not said otherwise.
 *
 * Exported because the reader needs the same three values: a stylesheet always
 * spells out colour, width and fill, so without knowing which spellings mean
 * "unspecified" every drawing would come back from a round trip carrying three
 * properties its author never set.
 */
export const DEFAULT_DRAWING_COLOR = '#e07a3f';
export const DEFAULT_DRAWING_STROKE_WIDTH = 'medium' satisfies ChapterAnnotationStrokeWidth;
export const DEFAULT_DRAWING_FILL_MODE = 'transparent' satisfies ChapterAnnotationFillMode;
/** Fill alpha that marks a shape as unfilled rather than solid. */
export const DRAWING_TRANSPARENT_FILL_ALPHA = 0.16;

const drawingAnnotationShape = (
  annotation: ChapterDrawingAnnotation,
): NeutralShape | null => {
  if (annotation.rect) return { type: 'rect', geometry: wholePixelRect(annotation.rect) };
  if (annotation.point) return { type: 'point', geometry: annotation.point };
  if (!annotation.points?.length) return null;
  if (annotation.type === 'line' && annotation.points.length >= 2) {
    return {
      type: 'line',
      geometry: {
        start: annotation.points[0],
        end: annotation.points[annotation.points.length - 1],
      },
    };
  }
  if (annotation.type === 'freehand' && annotation.points.length >= 2) {
    return { type: 'freehand', geometry: { points: annotation.points } };
  }
  if (annotation.type === 'polygon' && annotation.points.length >= 3) {
    return { type: 'polygon', geometry: { points: annotation.points } };
  }
  return null;
};

/**
 * Builds the canonical W3C document used by both live story authoring and
 * story export. Story state remains the compact persistence format, but it no
 * longer has a second annotation interpretation.
 */
export const storyDrawingDocument = (
  drawing: ChapterDrawingAnnotation,
  canvasId: string,
  annotationId = drawing.id,
): CanonicalAnnotation | null => {
  const shape = drawingAnnotationShape(drawing);
  if (!shape) return null;
  const textBodies = Object.entries(drawing.label ?? {}).flatMap(([language, value]) =>
    value.trim()
      ? [{ value: value.trim(), language, purpose: 'commenting' }]
      : [],
  );
  const legacyText = textBodies.length === 0 ? drawing.text?.trim() : undefined;
  const hasText = textBodies.length > 0 || Boolean(legacyText);
  const color = safeAnnotationColor(drawing.color ?? DEFAULT_DRAWING_COLOR);
  const styleClass = styleClassForLayer(`story-${drawing.id}`);
  const stylesheet = buildAnnotationStylesheet({
    className: styleClass,
    strokeColor: color,
    fillColor:
      drawing.fillMode === 'solid'
        ? color
        : rgbaFromHex(color, DRAWING_TRANSPARENT_FILL_ALPHA),
    strokeWidth:
      ANNOTATION_STROKE_WIDTH_PX[drawing.strokeWidth ?? DEFAULT_DRAWING_STROKE_WIDTH],
  });

  return createMangoAnnotation({
    id: annotationId,
    canvasId,
    shape,
    text: legacyText,
    textBodies,
    /*
     * The author's choice wins when they made one. The fallback is not a
     * default so much as a guess from shape: a region with words on it reads
     * as a comment, one without as a highlight — which is all that could be
     * inferred before the builder let anyone say.
     */
    motivation: drawing.motivation ?? (hasText ? 'commenting' : 'highlighting'),
    bodyPurpose: 'commenting',
    styleClass,
    stylesheet,
  });
};

export const storyDrawingToResolved = (
  drawing: ChapterDrawingAnnotation,
  canvasId: string,
  preferredLanguages: readonly string[],
): ResolvedAnnotation | null => {
  const document = storyDrawingDocument(drawing, canvasId);
  if (!document) return null;
  const projection = projectToResolved(document, {
    provenance: 'local',
    canvasId,
    policy: { preferredLanguages },
  });
  if (!projection) return null;
  const labels = drawing.label ?? {};
  const label =
    preferredLanguages.map((language) => labels[language]).find(Boolean) ??
    labels.en ??
    Object.values(labels)[0] ??
    drawing.text;
  return {
    ...projection,
    id: drawing.id,
    ...(label?.trim() ? { label: label.trim() } : {}),
  };
};
