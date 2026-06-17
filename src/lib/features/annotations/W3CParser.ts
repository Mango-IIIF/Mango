import type { AnnotationPoint, ResolvedAnnotation } from '../../iiif/annotationResolver';

export type W3CFragmentSelector = {
  type: 'FragmentSelector';
  conformsTo: 'http://www.w3.org/TR/media-frags/';
  value: string;
};

export type W3CSvgSelector = {
  type: 'SvgSelector';
  value: string;
};

export type W3CAnnotation = {
  id: string;
  type: 'Annotation';
  motivation: 'commenting' | 'painting' | string;
  body: Array<{
    type: 'TextualBody';
    value: string;
    format?: 'text/html' | 'text/plain';
    language?: string;
    purpose?: string;
  }>;
  target: {
    type: 'SpecificResource';
    source: string;
    selector: W3CFragmentSelector | W3CSvgSelector;
  };
};

const normaliseTag = (value: string): string => value.trim().replace(/\s+/g, ' ');

const toTextBody = (
  value: string,
  purpose?: string,
): {
  type: 'TextualBody';
  value: string;
  format: 'text/plain';
  purpose?: string;
} => ({
  type: 'TextualBody',
  value,
  format: 'text/plain',
  ...(purpose ? { purpose } : {}),
});

const toBodies = (
  annotation: ResolvedAnnotation,
): Array<{
  type: 'TextualBody';
  value: string;
  format: 'text/plain';
  purpose?: string;
}> => {
  const text = (annotation.text ?? annotation.bodies?.[0]?.value ?? '').trim();
  const notes = (annotation.notes ?? '').trim();
  const tags = (annotation.tags ?? []).map(normaliseTag).filter(Boolean);
  const bodies: Array<{
    type: 'TextualBody';
    value: string;
    format: 'text/plain';
    purpose?: string;
  }> = [];

  if (text || (!notes && tags.length === 0)) {
    bodies.push(toTextBody(text, 'commenting'));
  }
  if (notes) {
    bodies.push(toTextBody(notes, 'describing'));
  }
  for (const tag of tags) {
    bodies.push(toTextBody(tag, 'tagging'));
  }
  return bodies;
};

const extractTextualValues = (
  bodies: W3CAnnotation['body'] | undefined,
): { text: string; notes: string; tags: string[] } => {
  const tags: string[] = [];
  const notes: string[] = [];
  let text = '';

  for (const body of bodies ?? []) {
    const value = (body.value ?? '').trim();
    if (!value) continue;
    const purpose = (body.purpose ?? '').trim().toLowerCase();
    if (purpose.endsWith('tagging')) {
      tags.push(normaliseTag(value));
      continue;
    }
    if (purpose.endsWith('describing')) {
      notes.push(value);
      continue;
    }
    if (!text) {
      text = value;
    }
  }

  const uniqueTags = Array.from(
    new Set(tags.filter(Boolean).map((tag) => tag.toLowerCase())),
  ).map((lower) => tags.find((tag) => tag.toLowerCase() === lower) ?? lower);

  return {
    text,
    notes: notes.join('\n\n'),
    tags: uniqueTags,
  };
};

const parseXYWH = (value: string) => {
  const match = value.match(/^xywh=pixel:([^,]+),([^,]+),([^,]+),([^,]+)$/);
  if (!match) return null;
  const parts = match.slice(1).map((v) => Number(v));
  if (parts.some((v) => Number.isNaN(v))) return null;
  return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
};

const pointsToSvg = (points: AnnotationPoint[]): string => {
  const path = points.map((p) => `${p.x},${p.y}`).join(' ');
  return `<svg><polygon points=\"${path}\" /></svg>`;
};

const svgToPoints = (svg: string): AnnotationPoint[] | null => {
  const match = svg.match(/points\s*=\s*["']([^"']+)["']/i);
  if (!match) return null;
  const points = match[1]
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter((parts) => parts.length === 2 && parts.every((v) => Number.isFinite(v)))
    .map(([x, y]) => ({ x, y }));
  return points.length > 1 ? points : null;
};

export const resolvedToW3C = (
  annotation: ResolvedAnnotation,
  canvasSource: string,
): W3CAnnotation | null => {
  const id =
    annotation.id || `anno-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const motivation = annotation.motivation?.[0] || 'sc:painting';
  const body = toBodies(annotation);

  if (annotation.rect) {
    return {
      id,
      type: 'Annotation',
      motivation,
      body,
      target: {
        type: 'SpecificResource',
        source: canvasSource,
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: `xywh=pixel:${annotation.rect.x},${annotation.rect.y},${annotation.rect.w},${annotation.rect.h}`,
        },
      },
    };
  }

  if (annotation.polygon?.points?.length) {
    return {
      id,
      type: 'Annotation',
      motivation,
      body,
      target: {
        type: 'SpecificResource',
        source: canvasSource,
        selector: {
          type: 'SvgSelector',
          value: annotation.polygon.svg ?? pointsToSvg(annotation.polygon.points),
        },
      },
    };
  }

  if (annotation.point) {
    return {
      id,
      type: 'Annotation',
      motivation,
      body,
      target: {
        type: 'SpecificResource',
        source: canvasSource,
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: `xywh=pixel:${annotation.point.x},${annotation.point.y},1,1`,
        },
      },
    };
  }

  return null;
};

export const w3cToResolved = (annotation: W3CAnnotation): ResolvedAnnotation | null => {
  const selector = annotation.target?.selector;
  if (!selector) return null;
  const { text, notes, tags } = extractTextualValues(annotation.body);
  const bodies = (annotation.body ?? []).map((body) => ({
    type: 'text' as const,
    value: body.value,
    format: body.format,
    language: body.language,
    purpose: body.purpose,
  }));

  if (selector.type === 'FragmentSelector') {
    const rect = parseXYWH(selector.value);
    if (!rect) return null;
    if (rect.w === 1 && rect.h === 1) {
      return {
        id: annotation.id,
        rect: undefined,
        time: undefined,
        point: { x: rect.x, y: rect.y },
        polygon: undefined,
        text,
        label: '',
        notes,
        tags,
        bodies,
        motivation: [annotation.motivation],
        stylesheets: [],
        targetStyleClass: '',
        targetStyle: '',
      };
    }
    const resolvedObj = {
      id: annotation.id,
      rect,
      time: undefined,
      point: undefined,
      polygon: undefined,
      text,
      label: '',
      notes,
      tags,
      bodies,
      motivation: [annotation.motivation],
      stylesheets: [],
      targetStyleClass: '',
      targetStyle: '',
    };
    return resolvedObj;
  }

  if (selector.type === 'SvgSelector') {
    const points = svgToPoints(selector.value);
    if (!points) return null;
    return {
      id: annotation.id,
      rect: undefined,
      time: undefined,
      point: undefined,
      polygon: { points, svg: selector.value },
      text,
      label: '',
      notes,
      tags,
      bodies,
      motivation: [annotation.motivation],
      stylesheets: [],
      targetStyleClass: '',
      targetStyle: '',
    };
  }

  return null;
};
