import { get, writable } from "svelte/store";
import {
  getManifestLabel,
  parseManifest,
  type ManifestoManifest,
} from "../../viewer/iiif/manifestoAdapter";
import {
  normalizeManifest,
  type NormalizedManifest,
} from "../types/normalized-iiif";

export type CanvasSummary = {
  id: string;
  label?: string;
  index: number;
  width?: number;
  height?: number;
  type?: string;
};

export type ManifestEntry = {
  id: string;
  json?: unknown;
  manifesto?: ManifestoManifest;
  model?: NormalizedManifest;
  resourceType?: "collection" | "manifest";
  label?: string;
  canvases: CanvasSummary[];
  isFetching: boolean;
  error?: string;
};

export const isIIIFCollection = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const resource = value as { type?: unknown; "@type"?: unknown };
  return (
    resource.type === "Collection" || resource["@type"] === "sc:Collection"
  );
};

export type ManifestCache = Record<string, ManifestEntry>;

const createEmptyEntry = (id: string): ManifestEntry => ({
  id,
  canvases: [],
  isFetching: false,
});

export const manifestsStore = writable<ManifestCache>({});

export const fetchManifest = async (manifestId: string): Promise<void> => {
  if (!manifestId) return;

  const cache = get(manifestsStore);
  const existing = cache[manifestId];
  if (existing?.isFetching) return;
  if (existing?.json) return;

  manifestsStore.update((current) => ({
    ...current,
    [manifestId]: {
      ...(current[manifestId] ?? createEmptyEntry(manifestId)),
      id: manifestId,
      isFetching: true,
      error: undefined,
    },
  }));

  try {
    const response = await fetch(manifestId);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const json: unknown = await response.json();
    const resourceType = isIIIFCollection(json) ? "collection" : "manifest";
    let manifestoObject: ManifestoManifest | undefined;
    let model: NormalizedManifest | undefined;
    let canvases: CanvasSummary[] = [];
    let label: string | undefined;

    if (resourceType === "manifest") {
      try {
        manifestoObject = parseManifest(json);
        model = normalizeManifest(json, manifestoObject, manifestId);
        canvases = model.canvases;
        label = model.label ?? getManifestLabel(manifestoObject);
      } catch (error) {
        console.error(
          "[Mango] Failed to parse manifest with manifesto.js:",
          error,
        );
        manifestoObject = undefined;
      }
    }

    manifestsStore.update((current) => ({
      ...current,
      [manifestId]: {
        id: manifestId,
        json,
        manifesto: manifestoObject,
        model,
        resourceType,
        label,
        canvases,
        isFetching: false,
      },
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    manifestsStore.update((current) => ({
      ...current,
      [manifestId]: {
        ...(current[manifestId] ?? createEmptyEntry(manifestId)),
        id: manifestId,
        isFetching: false,
        error: message,
      },
    }));
  }
};
