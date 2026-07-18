import { derived, type Readable } from "svelte/store";
import { getCanvasAnnotations } from "../../iiif/annotationResolver";
import type { ResolvedAnnotation } from "../../iiif/annotationResolver";
import type { CanvasSummary, ManifestEntry } from "../../state/manifests";
import type { ViewerStateStores } from "../state/viewerState";
import {
  IIIFSearchClient,
  type Fetcher,
  type SearchResult as IIIFSearchResult,
} from "@mango-iiif/iiif-search-client";
import type { IIIFSearchAnnotation } from "../state/viewerState";

const getCanvasKey = (
  canvas: CanvasSummary | undefined,
  index: number,
): string => canvas?.id ?? `index-${index}`;

const isPaintingMotivation = (annotation: ResolvedAnnotation): boolean =>
  annotation.motivation?.some((m) => m === "painting" || m === "sc:painting") ??
  false;

const hasImageBody = (annotation: ResolvedAnnotation): boolean =>
  annotation.bodies?.some((body) => body.type === "image") ?? false;

const hasSpecificTarget = (annotation: ResolvedAnnotation): boolean =>
  Boolean(
    annotation.rect ||
    annotation.point ||
    annotation.polygon ||
    annotation.time,
  );

const shouldDisplayOverlayAnnotation = (
  annotation: ResolvedAnnotation,
): boolean => {
  if (!isPaintingMotivation(annotation)) return true;

  // Exclude canvas-level painting entries and image-resource painting entries,
  // but keep targeted painting annotations (common in IIIF v2 text/transcription data).
  if (hasImageBody(annotation)) return false;
  return hasSpecificTarget(annotation);
};

// Track ongoing search requests to prevent race conditions
let currentSearchController: AbortController | null = null;

const LEGACY_SEARCH_PROFILE = "http://iiif.io/api/search/0/search";

const readServiceId = (value: Record<string, unknown>): string | null => {
  const id = value.id ?? value["@id"];
  return typeof id === "string" && id ? id : null;
};

const hasLegacySearchProfile = (profile: unknown): boolean => {
  if (typeof profile === "string") return profile === LEGACY_SEARCH_PROFILE;
  if (Array.isArray(profile)) return profile.some(hasLegacySearchProfile);
  if (!profile || typeof profile !== "object") return false;
  return (
    readServiceId(profile as Record<string, unknown>) === LEGACY_SEARCH_PROFILE
  );
};

const findLegacySearchServiceUrl = (manifest: unknown): string | null => {
  if (!manifest || typeof manifest !== "object") return null;
  const value = manifest as Record<string, unknown>;
  const services = value.service ?? value.services;
  const entries = Array.isArray(services)
    ? services
    : services
      ? [services]
      : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const service = entry as Record<string, unknown>;
    if (hasLegacySearchProfile(service.profile ?? service["@profile"])) {
      return readServiceId(service);
    }
  }
  return null;
};

export const createIIIFSearchClient = (
  manifest: unknown,
  fetcher: Fetcher,
): IIIFSearchClient => {
  try {
    return IIIFSearchClient.fromManifest(manifest, { fetcher });
  } catch (error) {
    const legacyUrl = findLegacySearchServiceUrl(manifest);
    if (!legacyUrl) throw error;
    return new IIIFSearchClient({ searchServiceUrl: legacyUrl, fetcher });
  }
};

export const mapIIIFSearchResult = (
  response: IIIFSearchResult,
): IIIFSearchAnnotation[] =>
  response.hits.flatMap((hit) =>
    hit.annotations.map((annotation) => ({
      id: annotation.id,
      text: annotation.text || hit.matchText || "",
      label: annotation.label,
      rect: annotation.geometry
        ? {
            x: annotation.geometry.x,
            y: annotation.geometry.y,
            w: annotation.geometry.w,
            h: annotation.geometry.h,
          }
        : undefined,
      canvasId: annotation.geometry?.canvasId,
    })),
  );

/**
 * Trigger IIIF search when query changes
 */
const triggerIIIFSearch = async (
  manifestEntry: ManifestEntry | undefined,
  query: string,
  iiifSearchResults: ViewerStateStores["iiifSearchResults"],
) => {
  // Cancel previous search if still running
  if (currentSearchController) {
    currentSearchController.abort();
  }

  // Clear results if query is empty
  if (!query || !manifestEntry) {
    iiifSearchResults.set([]);
    return;
  }

  const controller = new AbortController();
  currentSearchController = controller;
  try {
    const client = createIIIFSearchClient(manifestEntry.json, (url, init) =>
      fetch(url, { ...init, signal: controller.signal }),
    );
    const response = await client.search({ q: query });
    const results = mapIIIFSearchResult(response);
    if (currentSearchController !== controller) return;
    iiifSearchResults.set(results);
  } catch (error: unknown) {
    if (controller.signal.aborted) return;
    const code =
      error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;
    if (code !== "SERVICE_NOT_FOUND") {
      console.warn("[Mango IIIF Search] Search failed:", error);
    }
    iiifSearchResults.set([]);
  } finally {
    if (currentSearchController === controller) {
      currentSearchController = null;
    }
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

  const allCanvasAnnotations = derived(
    [manifestEntry, canvases, state.userAnnotations, state.externalAnnotations],
    ([entry, list, userAnnotations, externalAnnotations]) => {
      if (list.length === 0) return [] as IIIFSearchAnnotation[];
      return list.flatMap((canvas, index) => {
        const manifestAnnotations = entry?.manifesto
          ? getCanvasAnnotations(entry.manifesto, canvas.id, index)
          : [];
        const key = getCanvasKey(canvas, index);
        return [
          ...manifestAnnotations,
          ...(externalAnnotations[key] ?? []),
          ...(userAnnotations[key] ?? []),
        ].map((annotation) => ({ ...annotation, canvasId: canvas.id }));
      });
    },
  );

  const searchHits = derived(
    [
      state.searchQuery,
      state.showSearch,
      allCanvasAnnotations,
      state.iiifSearchResults,
    ],
    ([query, showSearch, items, iiifResults]) => {
      const normalised = query.trim().toLowerCase();
      if (!showSearch || !normalised) return [];

      // If we have IIIF search results, return all results from the entire manifest
      if (iiifResults.length > 0) {
        return iiifResults;
      }

      // Otherwise, fall back to annotations from every canvas in the manifest.
      return items.filter((annotation) =>
        `${annotation.label ?? ""} ${annotation.text ?? ""}`
          .toLowerCase()
          .includes(normalised),
      );
    },
  );

  const overlayAnnotations = derived(
    [
      state.showAnnotations,
      annotations,
      searchHits,
      canvases,
      state.selectedCanvasIndex,
    ],
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
      return hits.filter((hit) => hit.canvasId === currentCanvas.id);
    },
  );

  const highlightIds = derived(
    [searchHits, state.selectedSearchResultId],
    ([hits, selectedId]) =>
      selectedId && hits.some((hit) => hit.id === selectedId)
        ? [selectedId]
        : hits.map((hit) => hit.id),
  );

  // Subscribe to search query changes and trigger IIIF search
  // Note: This subscription intentionally has an empty callback because the side effects
  // (triggering IIIF search) happen in the derived store's computation function.
  // Svelte's derived stores automatically clean up when the component unmounts.
  derived(
    [manifestEntry, state.searchQuery, state.showSearch],
    ([$manifestEntry, $searchQuery, $showSearch]) => {
      if ($showSearch) {
        triggerIIIFSearch(
          $manifestEntry,
          $searchQuery.trim(),
          state.iiifSearchResults,
        );
      } else {
        state.iiifSearchResults.set([]);
      }
    },
  ).subscribe(() => {});

  return {
    annotations,
    searchHits,
    overlayAnnotations,
    highlightIds,
  };
};
