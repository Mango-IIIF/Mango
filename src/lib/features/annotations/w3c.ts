import {
  W3CParser,
  type NormalizedShape,
  type W3CAnnotation,
} from '@mango-iiif/w3c-parser';
import type {
  AnnotationBody,
  ResolvedAnnotation,
} from '../../iiif/annotationResolver';

const normaliseTag = (value: string): string => value.trim().replace(/\s+/g, ' ');

const readBodies = (annotation: unknown): Array<Record<string, unknown>> => {
  if (!annotation || typeof annotation !== 'object') return [];
  const body = (annotation as { body?: unknown }).body;
  if (!body) return [];
  return (Array.isArray(body) ? body : [body]).filter(
    (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object',
  );
};

const resolvedShape = (annotation: ResolvedAnnotation): NormalizedShape | null => {
  if (annotation.rect) return { type: 'rect', geometry: annotation.rect };
  if (annotation.point) return { type: 'point', geometry: annotation.point };
  if (annotation.polygon?.points?.length) {
    return { type: 'polygon', geometry: { points: annotation.polygon.points } };
  }
  return null;
};

const shapeToResolved = (
  shape: NormalizedShape,
): Pick<ResolvedAnnotation, 'rect' | 'point' | 'polygon'> => {
  if (shape.type === 'rect') return { rect: shape.geometry };
  if (shape.type === 'point') return { point: shape.geometry };
  if (shape.type === 'polygon') return { polygon: { points: shape.geometry.points } };
  if (shape.type === 'line') {
    return { polygon: { points: [shape.geometry.start, shape.geometry.end] } };
  }
  if (shape.type === 'freehand') return { polygon: { points: shape.geometry.points } };
  return {};
};

const toAnnotationBodies = (annotation: unknown): AnnotationBody[] =>
  readBodies(annotation).map((body) => {
    const format = typeof body.format === 'string' ? body.format : undefined;
    return {
      type: format === 'text/html' ? 'html' : 'text',
      value: typeof body.value === 'string' ? body.value : '',
      format,
      language: typeof body.language === 'string' ? body.language : undefined,
      purpose: typeof body.purpose === 'string' ? body.purpose : undefined,
    };
  });

export const resolvedToW3C = (
  annotation: ResolvedAnnotation,
  canvasSource: string,
): W3CAnnotation | null => {
  const shape = resolvedShape(annotation);
  if (!shape) return null;

  const serialized = W3CParser.serialize({
    id: annotation.id || `anno-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    canvasId: canvasSource,
    text: (annotation.text ?? annotation.bodies?.[0]?.value ?? '').trim(),
    label: annotation.label || undefined,
    layer: annotation.targetStyleClass || undefined,
    shape,
  });

  const body = [...serialized.body];
  const notes = annotation.notes?.trim();
  if (notes) {
    body.push({ type: 'TextualBody', value: notes, format: 'text/plain', purpose: 'describing' });
  }
  for (const tag of (annotation.tags ?? []).map(normaliseTag).filter(Boolean)) {
    body.push({ type: 'TextualBody', value: tag, format: 'text/plain', purpose: 'tagging' });
  }

  return {
    ...serialized,
    motivation: annotation.motivation?.[0] || serialized.motivation,
    body,
  };
};

export const w3cToResolved = (annotation: unknown): ResolvedAnnotation | null => {
  let parsed;
  try {
    parsed = W3CParser.parseAnnotation(annotation);
  } catch {
    return null;
  }

  const source = annotation as {
    motivation?: string | string[];
    target?: { styleClass?: string; style?: string } | string;
  };
  const bodies = toAnnotationBodies(annotation);
  const tags = bodies
    .filter((body) => body.purpose?.toLowerCase().endsWith('tagging'))
    .map((body) => normaliseTag(body.value ?? ''))
    .filter(Boolean);
  const notes = bodies
    .filter((body) => body.purpose?.toLowerCase().endsWith('describing'))
    .map((body) => body.value ?? '')
    .filter(Boolean)
    .join('\n\n');
  const motivations = Array.isArray(source.motivation)
    ? source.motivation
    : source.motivation
      ? [source.motivation]
      : undefined;
  const target = typeof source.target === 'object' ? source.target : undefined;

  return {
    id: parsed.id,
    ...shapeToResolved(parsed.shape),
    time: parsed.temporal
      ? { start: parsed.temporal.start, end: parsed.temporal.end }
      : undefined,
    text: parsed.text,
    label: parsed.label,
    notes,
    tags: Array.from(new Set(tags)),
    bodies,
    motivation: motivations,
    targetStyleClass: target?.styleClass ?? parsed.layer,
    targetStyle: target?.style,
  };
};

export type { W3CAnnotation } from '@mango-iiif/w3c-parser';
