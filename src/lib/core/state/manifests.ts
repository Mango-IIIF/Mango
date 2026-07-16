import { get, writable } from 'svelte/store';
import * as manifesto from 'manifesto.js';

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
  manifesto?: any;
  resourceType?: 'collection' | 'manifest';
  label?: string;
  canvases: CanvasSummary[];
  isFetching: boolean;
  error?: string;
};

export const isIIIFCollection = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const resource = value as { type?: unknown; '@type'?: unknown };
  return resource.type === 'Collection' || resource['@type'] === 'sc:Collection';
};

export type ManifestCache = Record<string, ManifestEntry>;

const createEmptyEntry = (id: string): ManifestEntry => ({
  id,
  canvases: [],
  isFetching: false,
});

const parseCanvases = (manifestoObject: any): CanvasSummary[] => {
  if (!manifestoObject) return [];

  try {
    const sequences = manifestoObject.getSequences();
    if (!sequences || sequences.length === 0) return [];

    const canvases = sequences[0].getCanvases();
    if (!canvases || canvases.length === 0) return [];

    return canvases.map((canvas: any, index: number) => ({
      id: canvas.id || '',
      label: canvas.getLabel()?.getValue() || `Canvas ${index + 1}`,
      index,
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      type: canvas.getType(),
    }));
  } catch (error) {
    return [];
  }
};

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
    const json = await response.json();
    const resourceType = isIIIFCollection(json) ? 'collection' : 'manifest';
    let manifestoObject: any | undefined;
    let canvases: CanvasSummary[] = [];
    let label: string | undefined;

    if (resourceType === 'manifest') {
      try {
        manifestoObject = manifesto.parseManifest(json);
        canvases = parseCanvases(manifestoObject);
        label = manifestoObject.getLabel()?.getValue();
      } catch (error) {
        console.error('[Mango] Failed to parse manifest with manifesto.js:', error);
        manifestoObject = undefined;
      }
    }

    manifestsStore.update((current) => ({
      ...current,
      [manifestId]: {
        id: manifestId,
        json,
        manifesto: manifestoObject,
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
