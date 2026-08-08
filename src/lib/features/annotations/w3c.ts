/**
 * Compatibility surface over the canonical adapter.
 *
 * Everything here is a thin wrapper on `canonical.ts`. It exists so the call
 * sites that spoke in terms of "a W3C annotation object" keep working through
 * one deprecation cycle; new code should take a `CanonicalAnnotation` and stay
 * in the document model rather than round-tripping through JSON.
 *
 * @deprecated Use `canonical.ts` directly.
 */

import { serializeWebAnnotation, type NeutralShape } from '@mango-iiif/w3c-parser';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import type { ChapterAnnotationTool } from '../../core/types/story';
import {
  createMangoAnnotation,
  resolveAnnotationJson,
  shapeFromResolved,
  shapeTool,
} from './canonical';

export type W3CAnnotation = Record<string, unknown>;

/**
 * Serializes a projection as standards-shaped JSON.
 *
 * Only for the export event's legacy payload and for tests. Building a document
 * from a projection is lossy by construction — anything the projection does not
 * model is not there to write — so an annotation that already has a canonical
 * document is serialized from that instead.
 */
export const resolvedToW3C = (
  annotation: ResolvedAnnotation,
  canvasSource: string,
): W3CAnnotation | null => {
  if (annotation.document) {
    return serializeWebAnnotation(annotation.document, { profile: 'iiif-presentation-3' }).json;
  }

  const shape = shapeFromResolved(annotation);
  if (shape.type === 'none') return null;

  const document = createMangoAnnotation({
    id: annotation.id || undefined,
    canvasId: canvasSource,
    shape,
    text: annotation.text ?? annotation.bodies?.[0]?.value,
    label: annotation.label,
    note: annotation.notes,
    tags: annotation.tags,
    motivation: annotation.motivation?.[0],
    styleClass: annotation.targetStyleClass,
  });
  return serializeWebAnnotation(document, { profile: 'iiif-presentation-3' }).json;
};

export const w3cToResolved = (annotation: unknown): ResolvedAnnotation | null =>
  resolveAnnotationJson(annotation, { provenance: 'local' }).annotation;

export const normalizedShapeTool = (
  shape: NeutralShape,
): Exclude<ChapterAnnotationTool, 'select'> | null => shapeTool(shape);

export const w3cShapeTool = (
  annotation: unknown,
): Exclude<ChapterAnnotationTool, 'select'> | null => {
  const resolved = w3cToResolved(annotation);
  if (!resolved) return null;
  return shapeTool(shapeFromResolved(resolved));
};
