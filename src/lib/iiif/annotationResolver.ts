import { W3CParser } from '@mango-iiif/w3c-parser';
import type {
  IIIFIdentifiable,
  IIIFSelector,
  IIIFTarget,
  IIIFAnnotation,
} from '../core/types/iiif';

export type AnnotationRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type AnnotationPoint = {
  x: number;
  y: number;
};

export type AnnotationPolygon = {
  points: AnnotationPoint[];
  svg?: string;
};

export type AnnotationTime = {
  start: number;
  end?: number;
};

export type AnnotationBody = {
  type: 'text' | 'html' | 'image' | 'unknown';
  value?: string;
  format?: string;
  language?: string;
  purpose?: string;
  src?: string;
  styleClass?: string;
  style?: string;
};

export type ResolvedAnnotation = {
  id: string;
  rect?: AnnotationRect;
  time?: AnnotationTime;
  point?: AnnotationPoint;
  polygon?: AnnotationPolygon;
  text?: string;
  label?: string;
  notes?: string;
  tags?: string[];
  bodies?: AnnotationBody[];
  motivation?: string[];
  stylesheets?: string[];
  targetStyleClass?: string;
  targetStyle?: string;
};

/**
 * Extracts the id from an IIIF identifiable value (string, {id}, or {@id})
 */
const readId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if ('id' in value && typeof value.id === 'string') return value.id;
    if ('@id' in value && typeof value['@id'] === 'string') return value['@id'];
  }
  return '';
};

const normaliseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseXYWH = (value: string): AnnotationRect | null => {
  const match = value.match(/xywh=([^&]+)/);
  if (!match) return null;
  const coords = match[1].replace(/^pixel:/, '');
  const parts = coords.split(',').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return {
    x: parts[0],
    y: parts[1],
    w: parts[2],
    h: parts[3],
  };
};

/**
 * Extracts the string value from an IIIF selector
 */
const extractSelectorValue = (
  selector: IIIFSelector | null | undefined,
): string | undefined => {
  if (!selector) return undefined;
  if (typeof selector === 'string') return selector;
  if (typeof selector === 'object') {
    if (typeof selector.value === 'string') return selector.value;
    if (typeof selector.fragment === 'string') return selector.fragment;
  }
  return undefined;
};

/**
 * Extracts the target canvas ID from an IIIF annotation target
 */
const extractTargetId = (target: IIIFTarget | null | undefined): string | undefined => {
  if (!target) return undefined;
  if (typeof target === 'string') {
    return target.split('#')[0]?.split('?')[0] ?? target;
  }
  if (Array.isArray(target)) {
    for (const entry of target) {
      const id = extractTargetId(entry);
      if (id) return id;
    }
    return undefined;
  }
  if (typeof target === 'object') {
    const targetObj = target as { source?: unknown };
    if ('source' in targetObj) return readId(targetObj.source) || undefined;
    return readId(target) || undefined;
  }
  return undefined;
};

/**
 * Extracts stylesheet URLs from an IIIF annotation
 */
const extractStylesheets = (annotation: IIIFAnnotation | null | undefined): string[] => {
  const entries = normaliseArray(annotation?.stylesheet);
  const styles = entries
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (typeof entry === 'object' && entry !== null) {
        return readId(entry as IIIFIdentifiable);
      }
      return '';
    })
    .filter(Boolean);
  return styles;
};

const parseTime = (value: string): AnnotationTime | null => {
  const match = value.match(/(?:\\?|#)t=([0-9.]+)(?:,([0-9.]+))?/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : undefined;
  if (Number.isNaN(start) || (end != null && Number.isNaN(end))) return null;
  return { start, end };
};

const parseSvgPointsFromPath = (value: string): AnnotationPoint[] => {
  const tokens = value.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return [];
  const points: AnnotationPoint[] = [];
  let command = '';
  let index = 0;
  let lastPoint: AnnotationPoint | null = null;

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) break;
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      index += 1;
      continue;
    }

    const x = Number(tokens[index]);
    const y = Number(tokens[index + 1]);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      index += 1;
      continue;
    }

    const isRelative = command === 'm' || command === 'l';
    const nextPoint: AnnotationPoint = {
      x: (isRelative && lastPoint ? lastPoint.x : 0) + x,
      y: (isRelative && lastPoint ? lastPoint.y : 0) + y,
    };

    if (command === 'M' || command === 'L' || command === 'm' || command === 'l') {
      points.push(nextPoint);
      lastPoint = nextPoint;
    }

    if (command === 'M') command = 'L';
    if (command === 'm') command = 'l';
    index += 2;
  }

  if (points.length > 0) return points;

  const allNumbers = value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!allNumbers) return [];
  const fallback: AnnotationPoint[] = [];
  for (let i = 0; i < allNumbers.length - 1; i += 2) {
    const x = Number(allNumbers[i]);
    const y = Number(allNumbers[i + 1]);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    fallback.push({ x, y });
  }
  return fallback;
};

const parseSvgSelector = (svg: string): AnnotationPolygon | null => {
  const pointsMatch = svg.match(/points=['"]([^'"]+)['"]/i);
  if (pointsMatch) {
    const points = pointsMatch[1]
      .trim()
      .split(/\s+/)
      .flatMap((pair) => pair.split(','))
      .map((value) => Number(value))
      .reduce<AnnotationPoint[]>((acc, value, idx, arr) => {
        if (idx % 2 === 0 && idx + 1 < arr.length) {
          const x = value;
          const y = arr[idx + 1];
          if (!Number.isNaN(x) && !Number.isNaN(y)) {
            acc.push({ x, y });
          }
        }
        return acc;
      }, []);
    return points.length > 0 ? { points, svg } : null;
  }

  const pathMatch = svg.match(/d=['"]([^'"]+)['"]/i);
  if (pathMatch) {
    const points = parseSvgPointsFromPath(pathMatch[1]);
    return points.length > 0 ? { points, svg } : null;
  }

  return null;
};

/**
 * Normalizes IIIF annotation motivation values
 */
const normaliseMotivation = (annotation: IIIFAnnotation | null | undefined): string[] => {
  const motivations = normaliseArray(annotation?.motivation);
  return motivations
    .map((value) =>
      typeof value === 'string' ? value : readId(value as IIIFIdentifiable),
    )
    .filter(Boolean);
};

/**
 * Normalizes IIIF annotation body data to a consistent format
 */
const normaliseBody = (body: unknown): AnnotationBody[] => {
  if (!body) return [];
  if (typeof body === 'string') {
    return [{ type: 'unknown', value: body }];
  }

  if (typeof body !== 'object') return [];
  const bodyObj = body as Record<string, unknown>;

  if (bodyObj.type === 'SpecificResource' && bodyObj.source) {
    const sourceBodies = normaliseBody(bodyObj.source);
    if (!bodyObj.styleClass && !bodyObj.style) return sourceBodies;
    return sourceBodies.map((entry) => ({
      ...entry,
      styleClass:
        typeof bodyObj.styleClass === 'string' ? bodyObj.styleClass : entry.styleClass,
      style: typeof bodyObj.style === 'string' ? bodyObj.style : entry.style,
    }));
  }

  const format = typeof bodyObj.format === 'string' ? bodyObj.format : undefined;
  const language = typeof bodyObj.language === 'string' ? bodyObj.language : undefined;
  const bodyType =
    typeof bodyObj.type === 'string'
      ? bodyObj.type
      : typeof bodyObj['@type'] === 'string'
        ? bodyObj['@type']
        : undefined;
  const rawValue =
    typeof bodyObj.value === 'string'
      ? bodyObj.value
      : typeof bodyObj.chars === 'string'
        ? bodyObj.chars
        : typeof bodyObj['cnt:chars'] === 'string'
          ? bodyObj['cnt:chars']
          : undefined;
  if (bodyType === 'TextualBody' || bodyType === 'Text' || typeof rawValue === 'string') {
    const isHtml = format === 'text/html' || format === 'application/html';
    return [
      {
        type: isHtml ? 'html' : 'text',
        value: rawValue ?? '',
        format,
        language,
        styleClass:
          typeof bodyObj.styleClass === 'string' ? bodyObj.styleClass : undefined,
        style: typeof bodyObj.style === 'string' ? bodyObj.style : undefined,
      },
    ];
  }

  if (
    bodyObj.type === 'Image' ||
    (typeof format === 'string' && format.startsWith('image/'))
  ) {
    const src = readId(bodyObj as IIIFIdentifiable);
    return src
      ? [
          {
            type: 'image',
            src,
            format,
            styleClass:
              typeof bodyObj.styleClass === 'string' ? bodyObj.styleClass : undefined,
            style: typeof bodyObj.style === 'string' ? bodyObj.style : undefined,
          },
        ]
      : [];
  }

  return [
    {
      type: 'unknown',
      value:
        typeof bodyObj.value === 'string'
          ? bodyObj.value
          : readId(bodyObj as IIIFIdentifiable),
      format,
      language,
      styleClass: typeof bodyObj.styleClass === 'string' ? bodyObj.styleClass : undefined,
      style: typeof bodyObj.style === 'string' ? bodyObj.style : undefined,
    },
  ];
};

/**
 * Extracts bodies from an IIIF annotation
 */
const extractBodies = (
  annotation: IIIFAnnotation | null | undefined,
): AnnotationBody[] => {
  const bodies = normaliseArray(
    (annotation as Record<string, unknown>)?.body ??
      (annotation as Record<string, unknown>)?.resource ??
      (annotation as Record<string, unknown>)?.item,
  );
  return bodies.flatMap((body) => normaliseBody(body));
};

/**
 * Extracts text content from an annotation
 */
const extractText = (
  annotation: IIIFAnnotation | null | undefined,
  bodies: AnnotationBody[],
): string | undefined => {
  const textParts = bodies
    .filter((body) => body.type === 'text' || body.type === 'html')
    .map((body) => {
      const value = body.value ?? '';
      return body.type === 'html' ? stripHtml(value) : value;
    })
    .filter(Boolean);
  if (textParts.length > 0) return textParts.join(' ');

  const annotationObj = annotation as Record<string, unknown>;
  const label = annotationObj?.label ?? annotationObj?.summary;
  if (typeof label === 'string') return label;
  if (Array.isArray(label)) return label.filter(Boolean).join(' ');
  if (label && typeof label === 'object') {
    const first = Object.values(label)[0];
    if (typeof first === 'string') return first;
    if (Array.isArray(first)) return first.filter(Boolean).join(' ');
  }

  return undefined;
};

/**
 * Extracts geometric and temporal data from an IIIF annotation target
 */
const extractTargetData = (
  target: IIIFTarget | null | undefined,
): {
  rect: AnnotationRect | null;
  time: AnnotationTime | null;
  point: AnnotationPoint | null;
  polygon: AnnotationPolygon | null;
  targetId?: string;
  targetStyleClass?: string;
  targetStyle?: string;
} => {
  let rect: AnnotationRect | null = null;
  let time: AnnotationTime | null = null;
  let point: AnnotationPoint | null = null;
  let polygon: AnnotationPolygon | null = null;
  let targetId = extractTargetId(target);
  let targetStyleClass: string | undefined;
  let targetStyle: string | undefined;

  const applyTarget = (entry: unknown) => {
    if (!entry || typeof entry !== 'object') return;
    const entryObj = entry as Record<string, unknown>;
    if (entryObj.styleClass && typeof entryObj.styleClass === 'string') {
      targetStyleClass = entryObj.styleClass;
    }
    if (entryObj.style && typeof entryObj.style === 'string') {
      targetStyle = entryObj.style;
    }
    targetId = targetId || extractTargetId(entry as IIIFTarget);
  };

  const applySelectorValue = (value: string | undefined) => {
    if (!value) return;
    rect = rect ?? parseXYWH(value);
    time = time ?? parseTime(value);
  };

  const inspectSelectors = (selectors: unknown[]) => {
    for (const entry of selectors) {
      if (!entry || typeof entry !== 'object') continue;
      const selector = entry as Record<string, unknown>;
      if (selector.type === 'PointSelector') {
        const x = Number(selector.x);
        const y = Number(selector.y);
        if (!Number.isNaN(x) && !Number.isNaN(y)) {
          point = point ?? { x, y };
        }
      }
      if (selector.type === 'SvgSelector' && typeof selector.value === 'string') {
        polygon = polygon ?? parseSvgSelector(selector.value);
      }
      applySelectorValue(extractSelectorValue(selector as IIIFSelector));
    }
  };

  if (typeof target === 'string') {
    applySelectorValue(target);
    return { rect, time, point, polygon, targetId, targetStyleClass, targetStyle };
  }

  if (Array.isArray(target)) {
    for (const entry of target) {
      const result = extractTargetData(entry);
      rect = rect ?? result.rect;
      time = time ?? result.time;
      point = point ?? result.point;
      polygon = polygon ?? result.polygon;
      targetId = targetId || result.targetId;
      targetStyleClass = targetStyleClass || result.targetStyleClass;
      targetStyle = targetStyle || result.targetStyle;
    }
    return { rect, time, point, polygon, targetId, targetStyleClass, targetStyle };
  }

  if (typeof target === 'object' && target !== null) {
    applyTarget(target);

    const targetObj = target as Record<string, unknown>;
    const selector = targetObj?.selector ?? targetObj?.selectors;
    const selectorItems = Array.isArray(selector) ? selector : selector ? [selector] : [];
    inspectSelectors(selectorItems);

    if (targetObj?.fragment) {
      applySelectorValue(targetObj.fragment as string);
    }
  }

  return { rect, time, point, polygon, targetId, targetStyleClass, targetStyle };
};

/**
 * Collects annotation items from an annotation page
 */
const collectAnnotationItems = (page: unknown): unknown[] => {
  if (!page || typeof page !== 'object') return [];
  const pageObj = page as Record<string, unknown>;
  if (Array.isArray(pageObj.items)) return pageObj.items;
  if (Array.isArray(pageObj.resources)) return pageObj.resources;
  return [];
};

/**
 * Resolves a single IIIF annotation to our internal format
 */
const resolveAnnotation = (
  annotation: unknown,
  canvasId: string | undefined,
  fallback: { value: number },
): ResolvedAnnotation | null => {
  if (!annotation || typeof annotation !== 'object') return null;

  const annotationObj = annotation as Record<string, unknown>;
  const target = annotationObj?.target ?? annotationObj?.on;
  const targetData = extractTargetData(target as IIIFTarget);
  let { rect, time, point, polygon, targetId, targetStyleClass } = targetData;
  const { targetStyle } = targetData;

  // Presentation v3 annotations use the package parser as the canonical geometry decoder.
  // The legacy resolver remains below for v2 resources and non-W3C target forms.
  if (annotationObj.type === 'Annotation' && target && typeof target === 'object') {
    try {
      const parsed = W3CParser.parseAnnotation(annotationObj);
      targetId = parsed.canvasId || targetId;
      time = parsed.temporal
        ? { start: parsed.temporal.start, end: parsed.temporal.end }
        : time;
      if (parsed.shape.type === 'rect') rect = parsed.shape.geometry;
      if (parsed.shape.type === 'point') point = parsed.shape.geometry;
      if (parsed.shape.type === 'polygon' || parsed.shape.type === 'freehand') {
        polygon = { points: parsed.shape.geometry.points };
      }
      if (parsed.shape.type === 'line') {
        polygon = { points: [parsed.shape.geometry.start, parsed.shape.geometry.end] };
      }
      targetStyleClass = parsed.layer || targetStyleClass;
    } catch {
      // Older IIIF annotations are intentionally handled by the compatibility path below.
    }
  }
  const motivations = normaliseMotivation(annotationObj as IIIFAnnotation);

  // Extract bodies first to check if it's an image or text annotation
  const bodies = extractBodies(annotationObj as IIIFAnnotation);

  // Filter out painting motivation ONLY if body is an image
  // (IIIF v2 uses sc:painting for both canvas images AND text transcriptions)
  if (
    motivations.some(
      (m) => m === 'painting' || m.endsWith(':painting') || m.endsWith('/painting'),
    )
  ) {
    const hasImageBody = bodies.some((b) => b.type === 'image');
    if (hasImageBody) {
      return null;
    }
  }
  const text = extractText(annotationObj as IIIFAnnotation, bodies);
  const stylesheets = extractStylesheets(annotationObj as IIIFAnnotation);

  if (canvasId) {
    if (targetId && targetId !== canvasId) {
      return null;
    }
    if (!rect && !time && !point && !polygon && targetId !== canvasId) {
      return null;
    }
  }

  const id = readId(annotationObj as IIIFIdentifiable) || `anno-${fallback.value++}`;
  return {
    id,
    rect: rect ?? undefined,
    time: time ?? undefined,
    point: point ?? undefined,
    polygon: polygon ?? undefined,
    text,
    bodies,
    motivation: motivations.length > 0 ? motivations : undefined,
    stylesheets: stylesheets.length > 0 ? stylesheets : undefined,
    targetStyleClass,
    targetStyle,
  };
};

/**
 * Pick a canvas from a manifesto manifest object using the manifesto.js API
 */
const pickCanvas = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): unknown | undefined => {
  if (!manifestoObject || typeof manifestoObject !== 'object') return undefined;

  // Type assertion for manifesto.js object - we know it has these methods
  const manifest = manifestoObject as {
    getSequences: () => Array<{ getCanvases: () => unknown[] }>;
  };

  const sequences = manifest.getSequences();
  if (!sequences || sequences.length === 0) return undefined;

  const canvases = sequences[0].getCanvases();
  if (!canvases || canvases.length === 0) return undefined;

  if (canvasId) {
    const match = canvases.find((canvas: unknown) => {
      const c = canvas as { id?: string };
      return c.id === canvasId;
    });
    if (match) return match;
  }

  if (typeof canvasIndex === 'number' && canvases[canvasIndex]) {
    return canvases[canvasIndex];
  }

  return canvases[0];
};

/**
 * Get all annotations for a specific canvas from a manifesto manifest object
 */
export const getCanvasAnnotations = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): ResolvedAnnotation[] => {
  const canvas = pickCanvas(manifestoObject, canvasId, canvasIndex);
  if (!canvas || typeof canvas !== 'object') return [];

  const canvasObj = canvas as {
    id?: string;
    getAnnotations?: () => unknown[];
    getOtherContent?: () => unknown[];
    __jsonld?: { otherContent?: unknown[] };
  };
  const resolvedCanvasId = canvasObj.id || canvasId;

  const results: ResolvedAnnotation[] = [];
  const fallback = { value: 0 };

  // Get annotation pages using manifesto.js API (IIIF v3)
  if (typeof canvasObj.getAnnotations === 'function') {
    const annotationPages = canvasObj.getAnnotations();
    for (const page of annotationPages) {
      const pageObj = page as {
        getItems?: () => unknown[];
        items?: unknown[];
      };
      // Get items from the annotation page
      const items =
        typeof pageObj.getItems === 'function' ? pageObj.getItems() : pageObj.items || [];

      for (const annotation of items) {
        const resolved = resolveAnnotation(annotation, resolvedCanvasId, fallback);
        if (resolved) results.push(resolved);
      }
    }
  }

  // Also check otherContent (for IIIF v2 manifests)
  // In v2, inline annotation lists are available synchronously via getProperty
  const canvasWithProperties = canvas as { getProperty?: (prop: string) => unknown };
  if (typeof canvasWithProperties.getProperty === 'function') {
    const otherContent = canvasWithProperties.getProperty('otherContent');
    if (Array.isArray(otherContent)) {
      for (const annotationList of otherContent) {
        // Each annotation list can have 'resources' (v2) or 'items'
        const annotations = collectAnnotationItems(annotationList);
        for (const annotation of annotations) {
          const resolved = resolveAnnotation(annotation, resolvedCanvasId, fallback);
          if (resolved) results.push(resolved);
        }
      }
    }
  }

  // For painting annotations (items/content), these are handled by getContent
  // which is already processed through mediaResolver for painting annotations
  // We only want non-painting annotations here

  return results;
};

/**
 * Get annotations from an annotation page JSON
 */
export const getAnnotationPageAnnotations = (
  pageJson: unknown,
  canvasId?: string,
): ResolvedAnnotation[] => {
  const results: ResolvedAnnotation[] = [];
  const fallback = { value: 0 };
  const items = collectAnnotationItems(pageJson);
  for (const annotation of items) {
    const resolved = resolveAnnotation(annotation, canvasId, fallback);
    if (resolved) results.push(resolved);
  }
  return results;
};

/**
 * Check if a canvas has external annotation references (URLs that need to be fetched)
 * This is important for v2 manifests where annotations are often external
 */
export const hasExternalAnnotationRefs = (canvas: unknown): boolean => {
  if (!canvas || typeof canvas !== 'object') return false;

  const canvasObj = canvas as {
    getProperty?: (prop: string) => unknown;
  };

  // Check for otherContent in v2 manifests using manifesto API
  if (typeof canvasObj.getProperty === 'function') {
    const otherContent = canvasObj.getProperty('otherContent');
    if (Array.isArray(otherContent)) {
      for (const entry of otherContent) {
        if (!entry) continue;

        // If it's a string URL, it's an external reference
        if (typeof entry === 'string') return true;

        // If it has an ID but no inline items/resources, it's an external reference
        if (typeof entry === 'object') {
          const id = readId(entry as IIIFIdentifiable);
          if (id) {
            const entryObj = entry as Record<string, unknown>;
            const hasInlineItems =
              Array.isArray(entryObj.items) || Array.isArray(entryObj.resources);
            if (!hasInlineItems) return true;
          }
        }
      }
    }
  }

  // Check for annotations property in v3 manifests
  // Note: In v3, manifesto.js typically loads annotation pages synchronously,
  // so if getAnnotations() returns pages, they should have items available.
  // External v3 annotations are less common and are handled by the external
  // annotation loader when it encounters annotation page URLs in the manifest.
  // For now, we rely on the external annotation loader to handle v3 external refs.

  return false;
};
