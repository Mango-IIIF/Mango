import type { ResolvedAnnotation } from "../../iiif/annotationResolver";
import { getAnnotationPageAnnotations } from "../../iiif/annotationResolver";

type ExternalAnnotationLoader = {
  load: (
    canvasJson: unknown,
    canvasKey: string,
    canvasId?: string,
  ) => Promise<ResolvedAnnotation[]>;
  getForKey: (canvasKey: string) => ResolvedAnnotation[] | undefined;
  clear: () => void;
};

const normaliseArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const call = (value: unknown, method: string, ...args: unknown[]): unknown => {
  const fn = asRecord(value)?.[method];
  return typeof fn === "function" ? fn.apply(value, args) : undefined;
};

const readId = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  const record = asRecord(value);
  const id = record?.id ?? record?.["@id"];
  return typeof id === "string" ? id : "";
};

/**
 * Collect external annotation page URLs from a canvas
 * These are URLs that need to be fetched to get the annotation content
 *
 * @param canvas - Either a manifesto canvas object or raw JSON
 * @returns Array of annotation page URLs that need to be fetched
 */
export const collectAnnotationPageRefs = (canvas: unknown): string[] => {
  if (!canvas) return [];
  const refs: string[] = [];

  // First try to get annotations via manifesto.js API if available
  let annotationCandidates: unknown[] = [];
  const canvasRecord = asRecord(canvas);

  // Try manifesto API for v3 annotations
  if (typeof canvasRecord?.getAnnotations === "function") {
    const annotationPages = call(canvas, "getAnnotations");
    if (Array.isArray(annotationPages)) {
      annotationCandidates.push(...annotationPages);
    }
  }

  // Try manifesto API for v2 otherContent
  if (typeof canvasRecord?.getProperty === "function") {
    const otherContent = call(canvas, "getProperty", "otherContent");
    if (otherContent) {
      annotationCandidates.push(...normaliseArray(otherContent));
    }
  }

  // Fallback to raw JSON if manifesto API didn't work
  if (annotationCandidates.length === 0) {
    annotationCandidates = [
      ...normaliseArray(canvasRecord?.annotations),
      ...normaliseArray(canvasRecord?.otherContent),
    ];
  }

  // Process candidates to find external URLs
  for (const entry of annotationCandidates) {
    if (!entry) continue;
    if (typeof entry === "string") {
      refs.push(entry);
      continue;
    }

    const id = readId(entry);
    if (!id) continue;

    // Check if this is an external reference (has ID but no inline items)
    // For manifesto objects, we need to check if getItems() returns empty or doesn't exist
    let hasItems = false;
    const entryRecord = asRecord(entry);
    if (typeof entryRecord?.getItems === "function") {
      const items = call(entry, "getItems");
      hasItems = Array.isArray(items) && items.length > 0;
    } else {
      // For raw JSON
      hasItems =
        Array.isArray(entryRecord?.items) ||
        Array.isArray(entryRecord?.resources);
    }

    if (!hasItems) {
      refs.push(id);
    }
  }
  return refs;
};

export const createExternalAnnotationLoader = (
  fetcher: typeof fetch = fetch,
): ExternalAnnotationLoader => {
  const externalAnnotationCache = new Map<string, ResolvedAnnotation[]>();
  const externalAnnotationRequests = new Set<string>();
  const refKeys = new Map<string, string>();
  const annotationsByKey = new Map<string, ResolvedAnnotation[]>();
  let requestId = 0;

  const load = async (
    canvasJson: unknown,
    canvasKey: string,
    canvasId?: string,
  ): Promise<ResolvedAnnotation[]> => {
    if (!canvasJson) return [];
    const refs = collectAnnotationPageRefs(canvasJson);
    const refKey = refs.join("|");
    const existing = annotationsByKey.get(canvasKey);
    if (refKeys.get(canvasKey) === refKey && existing) {
      return existing;
    }
    refKeys.set(canvasKey, refKey);
    annotationsByKey.set(canvasKey, []);
    if (refs.length === 0) {
      return [];
    }

    const currentRequestId = ++requestId;
    const results = await Promise.all(
      refs.map(async (url) => {
        const cacheKey = `${canvasId ?? ""}::${url}`;
        const cached = externalAnnotationCache.get(cacheKey);
        if (cached) {
          return cached;
        }
        if (externalAnnotationRequests.has(cacheKey)) {
          return [];
        }
        externalAnnotationRequests.add(cacheKey);
        try {
          const response = await fetcher(url);
          if (!response.ok) {
            console.warn(
              "[Mango ExternalAnnotations] Failed to fetch annotation page",
              url,
              "- status:",
              response.status,
            );
            return [];
          }
          const pageJson = await response.json();
          const parsed = getAnnotationPageAnnotations(pageJson, canvasId);
          externalAnnotationCache.set(cacheKey, parsed);
          return parsed;
        } catch (error) {
          console.warn(
            "[Mango ExternalAnnotations] Failed to load annotation page",
            url,
            error,
          );
          return [];
        } finally {
          externalAnnotationRequests.delete(cacheKey);
        }
      }),
    );

    if (currentRequestId !== requestId) {
      return annotationsByKey.get(canvasKey) ?? [];
    }
    const merged = results.flat();
    annotationsByKey.set(canvasKey, merged);
    return merged;
  };

  const getForKey = (canvasKey: string): ResolvedAnnotation[] | undefined =>
    annotationsByKey.get(canvasKey);

  const clear = () => {
    externalAnnotationCache.clear();
    externalAnnotationRequests.clear();
    refKeys.clear();
    annotationsByKey.clear();
    requestId = 0;
  };

  return { load, getForKey, clear };
};
