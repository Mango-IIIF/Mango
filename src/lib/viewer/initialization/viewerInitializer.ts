/**
 * Viewer Initialization Helper
 * 
 * Extracts initialization logic from Viewer.svelte to improve testability
 * and reduce complexity in the component. This follows CODE_REVIEW.md
 * recommendation 1.3: "Extract Viewer Initialization Logic"
 */

import { get } from 'svelte/store';
import { fetchManifest, manifestsStore } from '../../state/manifests';
import type { ManifestEntry } from '../../state/manifests';
import { resolveMedia } from '../../iiif/mediaResolver';
import type { MediaSource } from '../../iiif/mediaResolver';
import { DEFAULT_IMAGE_FILTERS, type ImageFilters } from '../../core/types/filters';
import type { ViewBox } from '../../core/types/viewer';
import type { ViewerConfig } from '../../core/types/config';
import type { URLStateParams } from '../osd/URLStateManager';
import { XYWHFragment } from '../osd/XYWHFragment';

/**
 * Configuration for viewer initialization
 */
export type ViewerInitConfig = {
  manifestId: string;
  initialCanvasIndex?: number;
  initialMediaIndex?: number;
};

export type InitialViewerState = {
  selectedCanvasIndex: number;
  layoutMode: 'single' | 'two-page' | 'continuous' | 'gallery';
  rotation: number;
  viewBox: ViewBox | null;
};

const validViewBox = (value: ViewBox | null | undefined): value is ViewBox =>
  Boolean(
    value &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y) &&
      Number.isFinite(value.w) &&
      Number.isFinite(value.h) &&
      value.w > 0 &&
      value.h > 0,
  );

const viewBoxFromUrl = (xywh?: string): ViewBox | null => {
  if (!xywh) return null;
  const fragment = XYWHFragment.fromString(xywh);
  const viewBox = { x: fragment.x, y: fragment.y, w: fragment.w, h: fragment.h };
  return validViewBox(viewBox) ? viewBox : null;
};

/** Resolve startup defaults, with URL hash values taking precedence over config. */
export const resolveInitialViewerState = (
  config: ViewerConfig = {},
  urlState: URLStateParams = {},
): InitialViewerState => {
  const configuredCanvasIndex = Number.isInteger(config.initialCanvasIndex)
    ? Math.max(0, config.initialCanvasIndex ?? 0)
    : 0;
  const configuredRotation = Number.isFinite(config.initialRotation)
    ? config.initialRotation ?? 0
    : 0;
  const urlViewBox = viewBoxFromUrl(urlState.xywh);
  const configuredViewBox = validViewBox(config.initialViewBox)
    ? { ...config.initialViewBox }
    : null;

  return {
    selectedCanvasIndex:
      Number.isInteger(urlState.canvasIndex) && (urlState.canvasIndex ?? -1) >= 0
        ? urlState.canvasIndex ?? 0
        : configuredCanvasIndex,
    layoutMode: config.initialLayoutMode ?? 'single',
    rotation: Number.isFinite(urlState.rotation)
      ? urlState.rotation ?? 0
      : configuredRotation,
    viewBox: urlViewBox ?? configuredViewBox,
  };
};

/**
 * State that needs to be reset when manifest changes
 */
export type ManifestChangeState = {
  selectedCanvasIndex: number;
  selectedMediaIndex: number;
  viewBox: ViewBox | null;
  zoom: number;
  searchQuery: string;
  imageFilters: ImageFilters;
};

/**
 * Result of media resolution
 */
export type MediaResolution = {
  mediaSources: MediaSource[];
  mediaSource: MediaSource | null;
  mediaType: string | null;
};

/**
 * Initialize manifest loading
 * Triggers async fetch of manifest data
 */
export const initializeManifest = async (manifestId: string): Promise<void> => {
  if (!manifestId) return;
  await fetchManifest(manifestId);
};

/**
 * Get manifest entry from store
 */
export const getManifestEntry = (manifestId: string): ManifestEntry | undefined => {
  if (!manifestId) return undefined;
  const store = get(manifestsStore);
  return store[manifestId];
};

/**
 * Create initial state when manifest changes
 * Returns state that should be reset
 */
export const createManifestChangeState = (): ManifestChangeState => ({
  selectedCanvasIndex: 0,
  selectedMediaIndex: 0,
  viewBox: null,
  zoom: 0,
  searchQuery: '',
  imageFilters: { ...DEFAULT_IMAGE_FILTERS },
});

/**
 * Resolve media sources for a canvas
 * Extracts the logic for determining which media sources are available
 */
export const resolveMediaForCanvas = (
  manifestEntry: ManifestEntry | undefined,
  canvasId: string | undefined,
  canvasIndex: number,
  selectedMediaIndex: number,
): MediaResolution => {
  if (!manifestEntry?.manifesto) {
    return {
      mediaSources: [],
      mediaSource: null,
      mediaType: null,
    };
  }

  const resolved = resolveMedia(
    manifestEntry.manifesto,
    canvasId,
    canvasIndex,
  );

  const nextSources = resolved.primary
    ? [resolved.primary, ...resolved.alternates]
    : [];

  // Clamp media index to valid range
  const validMediaIndex = selectedMediaIndex >= nextSources.length ? 0 : selectedMediaIndex;
  const mediaSource = nextSources[validMediaIndex] ?? null;

  return {
    mediaSources: nextSources,
    mediaSource,
    mediaType: mediaSource?.type ?? null,
  };
};

/**
 * Validate and clamp canvas index to valid range
 */
export const validateCanvasIndex = (
  canvasIndex: number,
  totalCanvases: number,
): number => {
  if (totalCanvases === 0) return 0;
  if (canvasIndex >= totalCanvases) return 0;
  if (canvasIndex < 0) return 0;
  return canvasIndex;
};

/**
 * Check if manifest has changed
 */
export const hasManifestChanged = (
  currentManifestId: string,
  previousManifestId: string,
): boolean => {
  return currentManifestId !== '' && currentManifestId !== previousManifestId;
};
