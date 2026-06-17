import * as manifesto from 'manifesto.js';
import { getCanvasAnnotations } from './annotationResolver';
import { resolveMediaFromCanvas, type MediaSource } from './mediaResolver';
import { normaliseLangValue } from '../viewer/iiif/manifestMetadata';
import type { IIIFIdentifiable } from '../core/types/iiif';

export type MediaTextTrack = {
  id: string;
  src: string;
  label?: string;
  language?: string;
  kind?: 'subtitles' | 'captions' | 'descriptions' | 'metadata' | 'chapters';
  default?: boolean;
  format?: string;
};

export type TranscriptEntry = {
  id: string;
  start: number;
  end?: number;
  text: string;
};

export type TocEntry = {
  id: string;
  label: string;
  canvasId: string;
  start: number;
  end?: number;
  depth: number;
};

const normaliseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * Extracts the id from an IIIF identifiable value
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

/**
 * Pick a canvas from a manifesto manifest object using the manifesto.js API
 */
const pickCanvas = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): unknown | undefined => {
  if (!manifestoObject || typeof manifestoObject !== 'object') return undefined;

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

const findCanvasById = (
  manifestoObject: unknown,
  canvasId: string,
): unknown | undefined => {
  if (!manifestoObject || typeof manifestoObject !== 'object') return undefined;

  const manifest = manifestoObject as {
    getSequences: () => Array<{ getCanvases: () => unknown[] }>;
  };

  const sequences = manifest.getSequences();
  if (!sequences || sequences.length === 0) return undefined;

  const canvases = sequences[0].getCanvases();
  if (!canvases || canvases.length === 0) return undefined;

  return canvases.find((canvas: unknown) => {
    const c = canvas as { id?: string };
    return c.id === canvasId;
  });
};

const parseTemporalFragment = (value: string): { start: number; end?: number } | null => {
  const match = value.match(/(?:\\?|#)t=([0-9.]+)(?:,([0-9.]+))?/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : undefined;
  if (Number.isNaN(start) || (end != null && Number.isNaN(end))) return null;
  return { start, end };
};

const splitCanvasId = (value: string): string => value.split('#')[0]?.split('?')[0] ?? value;

/**
 * Normalizes IIIF annotation motivation values
 */
const normaliseMotivation = (annotation: unknown): string[] => {
  if (!annotation || typeof annotation !== 'object') return [];
  const annotationObj = annotation as { motivation?: unknown };
  const motivations = normaliseArray(annotationObj?.motivation);
  return motivations
    .map((entry) => (typeof entry === 'string' ? entry : readId(entry as IIIFIdentifiable)))
    .filter(Boolean);
};

/**
 * Extracts bodies from an IIIF annotation
 */
const extractAnnotationBody = (annotation: unknown): unknown[] => {
  if (!annotation || typeof annotation !== 'object') return [];
  const annotationObj = annotation as Record<string, unknown>;
  const body = annotationObj?.body ?? annotationObj?.resource ?? annotationObj?.item;
  return normaliseArray(body);
};

const isTextTrackFormat = (format?: string, src?: string): boolean => {
  const lowerFormat = format?.toLowerCase() ?? '';
  const lowerSrc = src?.toLowerCase() ?? '';
  return (
    lowerFormat.includes('vtt') ||
    lowerFormat.includes('webvtt') ||
    lowerFormat.includes('srt') ||
    lowerFormat.includes('subrip') ||
    lowerFormat.includes('ttml') ||
    lowerSrc.endsWith('.vtt') ||
    lowerSrc.endsWith('.srt') ||
    lowerSrc.endsWith('.ttml') ||
    lowerSrc.endsWith('.dfxp')
  );
};

const resolveTrackKind = (label?: string): MediaTextTrack['kind'] => {
  const normalised = label?.toLowerCase() ?? '';
  if (normalised.includes('subtitle')) return 'subtitles';
  if (normalised.includes('caption')) return 'captions';
  return 'captions';
};

/**
 * Parses time information from an annotation target
 */
const parseTargetTime = (
  target: unknown,
): { canvasId: string; start: number; end?: number } | null => {
  if (!target) return null;
  if (typeof target === 'string') {
    const time = parseTemporalFragment(target);
    return {
      canvasId: splitCanvasId(target),
      start: time?.start ?? 0,
      end: time?.end,
    };
  }
  
  if (typeof target !== 'object') return null;

  const targetObj = target as {
    source?: unknown;
    selector?: unknown;
    selectors?: unknown;
  };
  const targetId = readId(target);
  const sourceId = readId(targetObj.source);
  const selector = targetObj.selector ?? targetObj.selectors;
  const selectorItems = Array.isArray(selector)
    ? selector
    : selector
    ? [selector]
    : [];

  for (const entry of selectorItems) {
    const entryObj = entry as { type?: unknown; t?: unknown; value?: unknown; fragment?: unknown };
    if (entryObj.type === 'PointSelector' && entryObj.t != null) {
      const start = Number(entryObj.t);
      if (!Number.isNaN(start)) {
        return {
          canvasId: sourceId || splitCanvasId(targetId),
          start,
        };
      }
    }
    const fragment =
      typeof entryObj.value === 'string'
        ? entryObj.value
        : typeof entryObj.fragment === 'string'
          ? entryObj.fragment
          : undefined;
    if (fragment) {
      const time = parseTemporalFragment(fragment);
      if (time) {
        return {
          canvasId: sourceId || splitCanvasId(targetId),
          start: time.start,
          end: time.end,
        };
      }
    }
  }

  if (targetId) {
    const time = parseTemporalFragment(targetId);
    if (time) {
      return {
        canvasId: splitCanvasId(targetId),
        start: time.start,
        end: time.end,
      };
    }
    return {
      canvasId: splitCanvasId(targetId),
      start: 0,
    };
  }

  return null;
};

/**
 * Resolves a range label from IIIF range data
 */
const resolveRangeLabel = (range: unknown, locale: string): string => {
  if (!range || typeof range !== 'object') return '';
  const rangeObj = range as { label?: unknown; summary?: unknown; title?: unknown };
  const labelSource = rangeObj?.label ?? rangeObj?.summary ?? rangeObj?.title;
  return normaliseLangValue(labelSource, locale).trim();
};

const isRange = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const valueObj = value as { type?: unknown; '@type'?: unknown; items?: unknown; ranges?: unknown };
  const type = valueObj.type || valueObj['@type'];
  if (typeof type === 'string' && type.toLowerCase().includes('range')) return true;
  return Array.isArray(valueObj.items) || Array.isArray(valueObj.ranges);
};

const isCanvasTarget = (value: unknown): boolean => {
  if (!value) return false;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower.includes('canvas') || lower.includes('#t=') || lower.includes('?t=');
  }
  const valueObj = value as { type?: unknown; '@type'?: unknown; id?: unknown; '@id'?: unknown };
  const type = valueObj.type || valueObj['@type'];
  if (typeof type === 'string' && type.toLowerCase().includes('canvas')) return true;
  if (valueObj.id || valueObj['@id']) return true;
  return false;
};

export const resolveAccompanyingCanvasMedia = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): MediaSource | null => {
  const canvas = pickCanvas(manifestoObject, canvasId, canvasIndex);
  if (!canvas) return null;
  
  // Use getProperty to access accompanyingCanvas
  const canvasObj = canvas as { getProperty?: (prop: string) => unknown };
  const accompanyingCanvasData = typeof canvasObj.getProperty === 'function'
    ? canvasObj.getProperty('accompanyingCanvas')
    : null;
  
  if (!accompanyingCanvasData) return null;
  
  const accompanying = normaliseArray(accompanyingCanvasData)[0];
  if (!accompanying) return null;

  let accompanyingCanvas = accompanying;
  if (typeof accompanying === 'string') {
    const match = findCanvasById(manifestoObject, accompanying);
    if (!match) return null;
    accompanyingCanvas = match;
  }

  const resolved = resolveMediaFromCanvas(accompanyingCanvas);
  if (resolved.primary?.type === 'image') return resolved.primary;
  return null;
};

export const resolveCaptionTracks = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
  locale = 'en',
): MediaTextTrack[] => {
  const canvas = pickCanvas(manifestoObject, canvasId, canvasIndex);
  if (!canvas) return [];
  const canvasObj = canvas as { getAnnotations?: () => unknown[] };

  const tracks: MediaTextTrack[] = [];
  
  // Get annotation pages using manifesto.js API
  if (typeof canvasObj.getAnnotations === 'function') {
    const annotationPages = canvasObj.getAnnotations();
    for (const page of annotationPages) {
      const pageObj = page as { getItems?: () => unknown[]; items?: unknown; resources?: unknown };
      const items = typeof pageObj.getItems === 'function'
        ? pageObj.getItems()
        : normaliseArray(pageObj.items ?? pageObj.resources);
      
      for (const annotation of items) {
        const motivations = normaliseMotivation(annotation);
        if (motivations.includes('painting')) continue;
        const bodies = extractAnnotationBody(annotation);
        for (const body of bodies) {
          const bodyObj = body as {
            format?: unknown;
            label?: unknown;
            language?: unknown;
            default?: unknown;
          };
          const annotationObj = annotation as {
            label?: unknown;
            language?: unknown;
            default?: unknown;
          };
          const src = readId(body);
          if (!src) continue;
          const format = typeof bodyObj.format === 'string' ? bodyObj.format : undefined;
          if (!isTextTrackFormat(format, src)) continue;
          const label = normaliseLangValue(bodyObj.label ?? annotationObj.label, locale);
          const language =
            typeof bodyObj.language === 'string'
              ? bodyObj.language
              : typeof annotationObj.language === 'string'
                ? annotationObj.language
                : undefined;
          const kind = resolveTrackKind(label);
          const defaultValue = Boolean(bodyObj.default ?? annotationObj.default);

          tracks.push({
            id: readId(annotation) || src,
            src,
            label: label || undefined,
            language,
            kind,
            default: defaultValue,
            format,
          });
        }
      }
    }
  }

  const seen = new Set<string>();
  const deduped: MediaTextTrack[] = [];
  for (const track of tracks) {
    if (seen.has(track.src)) continue;
    seen.add(track.src);
    deduped.push(track);
  }

  if (deduped.length > 0 && !deduped.some((track) => track.default)) {
    deduped[0] = { ...deduped[0], default: true };
  }

  return deduped;
};

export const resolveTranscriptEntries = (
  manifestoObject: unknown,
  canvasId?: string,
  canvasIndex?: number,
): TranscriptEntry[] => {
  const annotations = getCanvasAnnotations(manifestoObject, canvasId, canvasIndex);
  const entries = annotations
    .filter((annotation) =>
      annotation.time &&
      annotation.time.start != null &&
      (annotation.text ?? '').trim(),
    )
    .map((annotation) => ({
      id: annotation.id,
      start: annotation.time?.start ?? 0,
      end: annotation.time?.end,
      text: annotation.text ?? '',
    }))
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i].end != null) continue;
    const next = entries[i + 1];
    if (next && next.start > entries[i].start) {
      entries[i].end = next.start;
    }
  }

  return entries;
};

export const resolveTocEntries = (
  manifestoObject: unknown,
  locale = 'en',
): TocEntry[] => {
  const manifestObj = manifestoObject as {
    __jsonld?: { structures?: unknown; ranges?: unknown; start?: unknown };
  } | null | undefined;
  const structures = normaliseArray(
    manifestObj?.__jsonld?.structures ?? manifestObj?.__jsonld?.ranges,
  );
  if (structures.length === 0) return [];

  const entries: TocEntry[] = [];

  const visitRange = (range: unknown, depth: number) => {
    if (!range || typeof range !== 'object') return;
    const label = resolveRangeLabel(range, locale);
    const rangeId = readId(range as IIIFIdentifiable) || `range-${entries.length + 1}`;
    const rangeObj = range as { items?: unknown; ranges?: unknown; canvases?: unknown };
    const items = normaliseArray(rangeObj.items ?? rangeObj.ranges ?? rangeObj.canvases);

    const canvasTargets = items.filter((item) => !isRange(item) && isCanvasTarget(item));
    for (let i = 0; i < canvasTargets.length; i += 1) {
      const target = canvasTargets[i];
      const targetId = typeof target === 'string' ? target : readId(target);
      const time = parseTargetTime(target) ?? (targetId ? parseTargetTime(targetId) : null);
      if (!time) continue;
      const entryId = `${rangeId}-${i}`;
      entries.push({
        id: entryId,
        label,
        canvasId: time.canvasId,
        start: time.start,
        end: time.end,
        depth,
      });
    }

    const childRanges = items.filter((item) => isRange(item));
    for (const child of childRanges) {
      visitRange(child, depth + 1);
    }
  };

  for (const range of structures) {
    visitRange(range, 0);
  }

  return entries;
};

export const resolveStartTime = (
  manifestoObject: unknown,
  canvasId?: string,
): number | null => {
  const manifestObj = manifestoObject as { __jsonld?: { start?: unknown } } | null | undefined;
  const start = manifestObj?.__jsonld?.start;
  if (!start) return null;

  if (typeof start === 'number' && Number.isFinite(start)) return start;
  if (typeof start === 'string') {
    const time = parseTemporalFragment(start);
    if (!time) return null;
    if (canvasId && splitCanvasId(start) !== canvasId) return null;
    return time.start;
  }

  if (typeof start === 'object') {
    const startObj = start as { source?: unknown; selector?: unknown; selectors?: unknown };
    const sourceId = readId(startObj.source);
    if (canvasId && sourceId && canvasId !== sourceId) return null;

    const selector = startObj.selector ?? startObj.selectors;
    const selectorItems = Array.isArray(selector)
      ? selector
      : selector
      ? [selector]
      : [];

    for (const entry of selectorItems) {
      const entryObj = entry as { type?: unknown; t?: unknown; value?: unknown; fragment?: unknown };
      if (entryObj.type === 'PointSelector' && entryObj.t != null) {
        const value = Number(entryObj.t);
        if (!Number.isNaN(value)) return value;
      }
      const fragment =
        typeof entryObj.value === 'string'
          ? entryObj.value
          : typeof entryObj.fragment === 'string'
            ? entryObj.fragment
            : undefined;
      if (fragment) {
        const time = parseTemporalFragment(fragment);
        if (time) return time.start;
      }
    }

    const targetTime = parseTargetTime(start);
    if (targetTime) return targetTime.start;
  }

  return null;
};
