import { derived, type Readable } from 'svelte/store';
import { getCanvasAnnotations } from '../../iiif/annotationResolver';
import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import type { CanvasSummary, ManifestEntry } from '../../state/manifests';
import type { ViewerStateStores } from '../state/viewerState';
import { getSearchServiceUrl, searchIIIF } from '../iiif/iiifSearch';

const getCanvasKey = (canvas: CanvasSummary | undefined, index: number): string =>
  canvas?.id ?? `index-${index}`;

const isPaintingMotivation = (annotation: ResolvedAnnotation): boolean =>
  annotation.motivation?.some((m) => m === 'painting' || m === 'sc:painting') ?? false;

const hasImageBody = (annotation: ResolvedAnnotation): boolean =>
  annotation.bodies?.some((body) => body.type === 'image') ?? false;

const hasSpecificTarget = (annotation: ResolvedAnnotation): boolean =>
  Boolean(annotation.rect || annotation.point || annotation.polygon || annotation.time);

const shouldDisplayOverlayAnnotation = (annotation: ResolvedAnnotation): boolean => {
  if (!isPaintingMotivation(annotation)) return true;

  // Exclude canvas-level painting entries and image-resource painting entries,
  // but keep targeted painting annotations (common in IIIF v2 text/transcription data).
  if (hasImageBody(annotation)) return false;
  return hasSpecificTarget(annotation);
};

// Track ongoing search requests to prevent race conditions
let currentSearchController: AbortController | null = null;
let lastSearchQuery = '';

/**
 * Trigger IIIF search when query changes
 */
const triggerIIIFSearch = async (
  manifestEntry: ManifestEntry | undefined,
  query: string,
  iiifSearchResults: ViewerStateStores['iiifSearchResults'],
) => {
  // Cancel previous search if still running
  if (currentSearchController) {
    currentSearchController.abort();
  }
  
  // Clear results if query is empty
  if (!query || !manifestEntry) {
    iiifSearchResults.set([]);
    lastSearchQuery = query;
    return;
  }
  
  // Don't search if query hasn't changed
  if (query === lastSearchQuery) {
    return;
  }
  lastSearchQuery = query;
  
  // Check if manifest has IIIF search service
  const searchServiceUrl = getSearchServiceUrl(manifestEntry.manifesto ?? manifestEntry.json);
  if (!searchServiceUrl) {
    // No IIIF search service, clear results to fall back to local search
    iiifSearchResults.set([]);
    return;
  }
  
  // Perform IIIF search
  currentSearchController = new AbortController();
  try {
    const results = await searchIIIF(searchServiceUrl, query, (url, init) =>
      fetch(url, { ...init, signal: currentSearchController?.signal }),
    );
    iiifSearchResults.set(results);
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      console.warn('[Mango IIIF Search] Search failed:', error);
    }
    iiifSearchResults.set([]);
  } finally {
    currentSearchController = null;
  }
};

export const createAnnotationDerivedStores = ({
  manifestEntry,
  canvases,
  state,
}: {
  manifestEntry: Readable<ManifestEntry | undefined>;
  canvases: Readable<CanvasSummary[]>;
  state: ViewerStateStores;
}) => {
  const annotations = derived(
    [
      manifestEntry,
      canvases,
      state.selectedCanvasIndex,
      state.userAnnotations,
      state.externalAnnotations,
    ],
    ([entry, list, index, userAnnotations, externalAnnotations]) => {
      if (!entry?.manifesto || list.length === 0) {
        return [] as ResolvedAnnotation[];
      }
      const canvas = list[index];
      const manifestAnnotations = getCanvasAnnotations(
        entry.manifesto,
        canvas?.id,
        index,
      );
      const key = getCanvasKey(canvas, index);
      const userItems = userAnnotations[key] ?? [];
      const externalItems = externalAnnotations[key] ?? [];
      const merged = [...manifestAnnotations, ...externalItems, ...userItems];
      return merged;
    },
  );

  const searchHits = derived(
    [state.searchQuery, state.showSearch, annotations, state.iiifSearchResults, manifestEntry],
    ([query, showSearch, items, iiifResults, entry]) => {
      const normalised = query.trim().toLowerCase();
      if (!showSearch || !normalised) return [];
      
      // If we have IIIF search results, return all results from the entire manifest
      if (iiifResults.length > 0) {
        return iiifResults;
      }
      
      // Otherwise, fall back to local annotation filtering (current canvas only)
      return items.filter((annotation) =>
        (annotation.text ?? '').toLowerCase().includes(normalised),
      );
    },
  );

  const overlayAnnotations = derived(
    [state.showAnnotations, annotations, searchHits, canvases, state.selectedCanvasIndex],
    ([showAnnotations, items, hits, canvasList, canvasIndex]) => {
      const displayable = items.filter((annotation) =>
        shouldDisplayOverlayAnnotation(annotation),
      );
      if (showAnnotations) {
        // Show all annotations for current canvas
        return displayable;
      }
      
      // During search, only show hits that belong to current canvas
      if (hits.length === 0) return hits;
      
      const currentCanvas = canvasList[canvasIndex];
      if (!currentCanvas) return [];
      
      // Filter search hits to only those on the current canvas
      return hits.filter((hit) => {
        const hitCanvasId = (hit as any).canvasId;
        return hitCanvasId === currentCanvas.id;
      });
    },
  );

  const highlightIds = derived(searchHits, (hits) =>
    hits.map((hit) => hit.id),
  );

  // Subscribe to search query changes and trigger IIIF search
  // Note: This subscription intentionally has an empty callback because the side effects
  // (triggering IIIF search) happen in the derived store's computation function.
  // Svelte's derived stores automatically clean up when the component unmounts.
  derived(
    [manifestEntry, state.searchQuery, state.showSearch],
    ([$manifestEntry, $searchQuery, $showSearch]) => {
      if ($showSearch) {
        triggerIIIFSearch($manifestEntry, $searchQuery.trim(), state.iiifSearchResults);
      } else {
        state.iiifSearchResults.set([]);
      }
    }
  ).subscribe(() => {});

  return {
    annotations,
    searchHits,
    overlayAnnotations,
    highlightIds,
  };
};
