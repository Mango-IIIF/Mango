/**
 * ViewerController
 *
 * Main controller that orchestrates sub-controllers and manages the viewer lifecycle.
 * Delegates specific responsibilities to focused controllers while coordinating overall state.
 */

import { get } from "svelte/store";
import { createEventBus } from "../../events/eventBus";
import type {
  ViewerEventBus,
  ViewerEventEmitter,
  ViewerEventMap,
} from "../../core/types/events";
import { fetchManifest } from "../../state/manifests";
import {
  DEFAULT_IMAGE_FILTERS,
  type ImageFilters,
} from "../../core/types/filters";
import type { ResolvedAnnotation } from "../../iiif/annotationResolver";
import type { MediaSource, MediaType } from "../../iiif/mediaResolver";
import type { ViewBox, ViewerStateSnapshot } from "../../core/types/viewer";
import { setLocale } from "../../i18n";
import { createAnnotationInteractionHandlers } from "../annotations/interactions";
import { createExternalAnnotationEffects } from "../annotations/externalAnnotations";
import type { ViewerDerivedStores } from "./viewerDerived";
import type { ViewerStateStores } from "./viewerState";

// Import sub-controllers
import {
  createCanvasController,
  type CanvasController,
} from "./controllers/CanvasController";
import {
  createMediaController,
  type MediaController,
} from "./controllers/MediaController";
import {
  createAnnotationController,
  type AnnotationController,
} from "./controllers/AnnotationController";
import {
  createPanelController,
  type PanelController,
  type ViewerPanel,
} from "./controllers/PanelController";
import {
  createViewStateController,
  type ViewStateController,
} from "./controllers/ViewStateController";

type Dispatch = ViewerEventEmitter;

export type ViewerController = {
  events: ViewerEventBus;
  on: ViewerEventBus["on"];
  off: ViewerEventBus["off"];
  emitStateChange: () => void;
  emitEvent: <K extends keyof ViewerEventMap>(
    event: K,
    payload: ViewerEventMap[K],
  ) => void;
  setEventTarget: (target: EventTarget) => void;
  getStateSnapshot: () => ViewerStateSnapshot;
  getCanvasIndex: () => number;
  getCanvasId: () => string | null;
  getCanvasCount: () => number;
  setCanvasByIndex: (index: number) => void;
  setCanvasById: (canvasId: string) => void;
  setManifest: (manifestId: string) => void;
  getManifestId: () => string | null;
  addAnnotation: (annotation: unknown) => Promise<void>;
  updateAnnotation: (
    annotationId: string,
    patch: Partial<ResolvedAnnotation>,
  ) => Promise<void>;
  removeAnnotation: (annotationId: string) => Promise<void>;
  updateImageFilter: <K extends keyof ImageFilters>(
    key: K,
    value: ImageFilters[K],
  ) => void;
  resetImageFilters: () => void;
  setAnnotationMode: (mode: "edit" | "create") => void;
  setSearchQuery: (value: string) => void;
  handleSearchResultClick: (annotation: ResolvedAnnotation) => void;
  setPanelOpen: (panel: ViewerPanel, open: boolean) => void;
  updateLayerOpacity: (id: string, opacity: number) => void;
  setLayoutMode: (
    mode: "single" | "two-page" | "continuous" | "gallery",
  ) => void;
  handleViewBoxChange: (detail: { viewBox: ViewBox }) => void;
  handleZoomChange: (detail: { zoom: number; viewBox: ViewBox }) => void;
  handleRotationChange: (detail: { rotation: number }) => void;
  handleMediaPlay: (detail: { time: number }) => void;
  handleMediaPause: (detail: { time: number }) => void;
  handleMediaTimeUpdate: (detail: { time: number; duration?: number }) => void;
  handleMediaSeek: (detail: { from: number; to: number }) => void;
  handleMediaSegmentEnd: () => void;
  handleModelChange: (detail: {
    source?: string;
    cameraOrbit?: string;
    cameraTarget?: string;
    fieldOfView?: string;
    orientation?: string;
  }) => void;
  handleAnnotationHover: (detail: { id: string | null }) => void;
  handleAnnotationSelect: (detail: {
    id: string;
    preventZoom?: boolean;
  }) => void;
  handleAnnotationClear: () => void;
  getMediaLabel: (
    source: MediaSource,
    translate: (key: string) => string,
  ) => string;
  getMediaTypeLabel: (
    type: MediaType | null,
    translate: (key: string) => string,
  ) => string;
  destroy: () => void;
};

export { type ViewerPanel };

export const createViewerController = ({
  state,
  derived: derivedStores,
  dispatch,
  applyViewBox = () => undefined,
}: {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  dispatch: Dispatch;
  applyViewBox?: (viewBox: ViewBox) => void;
}): ViewerController => {
  const eventBus: ViewerEventBus = createEventBus();
  let eventTarget: EventTarget | null = null;
  const unsubscribers: Array<() => void> = [];

  let lastManifestId = "";
  let lastErrorMessage = "";
  let lastSearchQuery = "";
  let lastConfigStr = "";

  const emitEvent: ViewerEventEmitter = (event, payload) => {
    eventBus.emit(event, payload);
    dispatch(event, payload);
    if (eventTarget) {
      eventTarget.dispatchEvent(
        new CustomEvent(event, {
          detail: payload,
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  const emitStateChange = () => {
    emitEvent("stateChange", { snapshot: getStateSnapshot() });
  };

  const getStateSnapshot = (): ViewerStateSnapshot => {
    const canvases = get(derivedStores.canvases);
    const canvasIndex = get(state.selectedCanvasIndex);
    const canvas = canvases[canvasIndex];
    return {
      manifestId: get(state.manifestId),
      canvasId: canvas?.id ?? null,
      canvasIndex,
      canvasLabel: canvas?.label,
      canvases: canvases.map((entry) => ({
        id: entry.id,
        label: entry.label,
        index: entry.index,
      })),
      mediaType: get(derivedStores.mediaType),
      viewBox: get(state.viewBox),
      zoom: get(state.zoom),
      searchQuery: get(state.searchQuery),
      annotationCount: get(derivedStores.annotations).length,
      layerOpacities: get(state.layerOpacities),
    };
  };

  // Create sub-controllers
  const viewStateController: ViewStateController = createViewStateController({
    state,
    emitEvent,
    applyViewBox,
  });

  const canvasController: CanvasController = createCanvasController({
    state,
    derived: derivedStores,
    emitEvent,
    emitStateChange,
    preserveViewport: get(state.config)?.osd?.preserveViewport ?? false,
  });

  const mediaController: MediaController = createMediaController({
    state,
    derived: derivedStores,
    emitEvent,
    emitStateChange,
    getCanvasId: canvasController.getCanvasId,
  });

  const annotationController: AnnotationController = createAnnotationController(
    {
      state,
      derived: derivedStores,
      emitEvent,
      emitStateChange,
      getCanvasId: canvasController.getCanvasId,
      getCanvasIndex: canvasController.getCanvasIndex,
      setCanvasById: canvasController.setCanvasById,
      setPendingViewBox: viewStateController.setPendingViewBox,
      applyViewBox,
    },
  );

  const panelController: PanelController = createPanelController({
    state,
    derived: derivedStores,
    emitEvent,
    emitStateChange,
    initialOpen:
      get(state.config)?.sidebar?.enabled !== false &&
      get(state.config)?.sidebar?.open !== false,
    initialActivePanel: get(state.config)?.sidebar?.activePanel,
  });

  // Setup annotation interactions
  const annotationInteractions = createAnnotationInteractionHandlers({
    state,
    derived: derivedStores,
    emitEvent,
  });

  // Setup external annotation effects
  const annotationEffects = createExternalAnnotationEffects({
    state,
    derived: derivedStores,
    getEventTarget: () => eventTarget,
  });

  const setEventTarget = (target: EventTarget) => {
    eventTarget = target;
  };

  const setManifest = (manifestId: string) => {
    state.collectionId.set("");
    state.showCollection.set(false);
    state.manifestId.set(manifestId);
  };

  const getManifestId = () => get(state.manifestId) || null;
  const clearPersistedAnnotations = () => {
    state.userAnnotations.set({});
  };

  // Setup effects from sub-controllers
  unsubscribers.push(...canvasController.setupCanvasEffects());
  unsubscribers.push(...mediaController.setupMediaEffects());
  unsubscribers.push(...panelController.setupPanelEffects());

  // Setup manifest subscription
  unsubscribers.push(
    state.manifestId.subscribe((manifestId) => {
      if (manifestId) {
        void fetchManifest(manifestId).then(() => {
          const entry = get(derivedStores.manifestEntry);
          if (
            entry?.id === manifestId &&
            entry.resourceType === "collection" &&
            get(state.manifestId) === manifestId
          ) {
            state.collectionId.set(manifestId);
            panelController.setPanelOpen("collection", true);
          }
        });
      }
      if (manifestId && manifestId !== lastManifestId) {
        const isInitialManifest = !lastManifestId;
        lastManifestId = manifestId;
        if (!isInitialManifest) {
          state.selectedCanvasIndex.set(0);
          state.viewBox.set(null);
          state.zoom.set(0);
          state.rotation.set(0);
        }
        state.selectedMediaIndex.set(0);
        state.searchQuery.set("");
        state.imageFilters.set({ ...DEFAULT_IMAGE_FILTERS });
        state.activeAnnotationId.set(null);
        state.hoverAnnotationId.set(null);
        state.mediaTime.set(0);
        state.mediaDuration.set(undefined);
        state.externalAnnotations.set({});
        clearPersistedAnnotations();
        annotationEffects.reset();
        emitEvent("manifestChange", { manifestId });
        emitStateChange();
      }
    }),
  );

  // Setup config subscription
  unsubscribers.push(
    state.config.subscribe((config) => {
      const next = JSON.stringify(config ?? {});
      if (next === lastConfigStr) return;
      lastConfigStr = next;
      const allowThumbnails = config?.showThumbnails !== false;
      const allowMetadata = config?.showMetadata !== false;
      const allowSearch = config?.showSearch !== false;
      const allowAnnotations = config?.showAnnotations !== false;
      const allowTools = config?.showTools !== false;

      if (config?.sidebar?.enabled === false) {
        state.showCollection.set(false);
        state.showContents.set(false);
        state.showAnnotations.set(false);
        state.showTools.set(false);
        state.showSettings.set(false);
        state.showSearch.set(false);
        state.showMetadata.set(false);
        state.showLayers.set(false);
      }

      if (!allowThumbnails) state.showThumbnails.set(false);
      if (config?.showCollection === false) state.showCollection.set(false);
      if (!allowMetadata) state.showMetadata.set(false);
      if (!allowSearch) state.showSearch.set(false);
      if (!allowAnnotations) state.showAnnotations.set(false);
      if (config?.showSettings === false) state.showSettings.set(false);
      if (config && Object.prototype.hasOwnProperty.call(config, "showTools")) {
        state.showTools.set(config.showTools !== false);
      } else if (!allowTools) {
        state.showTools.set(false);
      }
    }),
  );

  // Setup error and manifest layout mode initialization subscription
  let loadedManifestId = "";
  let loadedAVManifestId = "";
  unsubscribers.push(
    derivedStores.manifestEntry.subscribe((entry) => {
      if (entry?.error && entry.error !== lastErrorMessage) {
        lastErrorMessage = entry.error;
        emitEvent("error", { scope: "manifest", message: entry.error });
      }
      if (entry?.manifesto && entry.id !== loadedManifestId) {
        loadedManifestId = entry.id;
        const viewingHint = entry.manifesto.getViewingHint?.()?.toString();
        const behaviors = entry.manifesto.getProperty?.("behavior");
        const behaviorList = Array.isArray(behaviors)
          ? behaviors
          : [behaviors].filter(Boolean);

        let defaultLayout: "single" | "two-page" | "continuous" = "single";
        if (viewingHint === "paged" || behaviorList.includes("paged")) {
          defaultLayout = "two-page";
        } else if (
          viewingHint === "continuous" ||
          behaviorList.includes("continuous")
        ) {
          defaultLayout = "continuous";
        }
        if (!get(state.config)?.initialLayoutMode) {
          state.layoutMode.set(defaultLayout);
        }
      }
      if (
        entry?.json &&
        entry.resourceType !== "collection" &&
        entry.id !== loadedAVManifestId
      ) {
        loadedAVManifestId = entry.id;
        void derivedStores.av.load(entry.json as Record<string, unknown>);
      }
    }),
  );

  // Setup search query subscription
  unsubscribers.push(
    state.searchQuery.subscribe((query) => {
      if (query !== lastSearchQuery) {
        lastSearchQuery = query;
        emitStateChange();
      }
    }),
  );

  // Setup locale subscription
  unsubscribers.push(
    derivedStores.uiLocale.subscribe((locale) => setLocale(locale)),
  );

  const updateLayerOpacity = (id: string, opacity: number) => {
    state.layerOpacities.update((map) => ({
      ...map,
      [id]: opacity,
    }));
    emitStateChange();
  };

  const setLayoutMode = (
    mode: "single" | "two-page" | "continuous" | "gallery",
  ) => {
    state.layoutMode.set(mode);
    emitStateChange();
  };

  const destroy = () => {
    annotationEffects.destroy();
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
    derivedStores.av.destroy();
  };

  // Return public API - delegate to sub-controllers
  return {
    events: eventBus,
    on: eventBus.on,
    off: eventBus.off,
    emitEvent,
    emitStateChange,
    setEventTarget,
    getStateSnapshot,

    // Canvas controller methods
    getCanvasIndex: canvasController.getCanvasIndex,
    getCanvasId: canvasController.getCanvasId,
    getCanvasCount: canvasController.getCanvasCount,
    setCanvasByIndex: canvasController.setCanvasByIndex,
    setCanvasById: canvasController.setCanvasById,

    // Manifest methods
    setManifest,
    getManifestId,

    // Annotation controller methods
    addAnnotation: annotationController.addAnnotation,
    updateAnnotation: annotationController.updateAnnotation,
    removeAnnotation: annotationController.removeAnnotation,
    setAnnotationMode: annotationController.setAnnotationMode,
    setSearchQuery: annotationController.setSearchQuery,
    handleSearchResultClick: annotationController.handleSearchResultClick,

    // View state controller methods
    updateImageFilter: viewStateController.updateImageFilter,
    resetImageFilters: viewStateController.resetImageFilters,
    handleViewBoxChange: viewStateController.handleViewBoxChange,
    handleZoomChange: viewStateController.handleZoomChange,
    handleRotationChange: viewStateController.handleRotationChange,

    // Panel controller methods
    setPanelOpen: panelController.setPanelOpen,
    updateLayerOpacity,
    setLayoutMode,

    // Media controller methods
    handleMediaPlay: mediaController.handleMediaPlay,
    handleMediaPause: mediaController.handleMediaPause,
    handleMediaTimeUpdate: mediaController.handleMediaTimeUpdate,
    handleMediaSeek: mediaController.handleMediaSeek,
    handleMediaSegmentEnd: mediaController.handleMediaSegmentEnd,
    handleModelChange: mediaController.handleModelChange,
    getMediaLabel: mediaController.getMediaLabel,
    getMediaTypeLabel: mediaController.getMediaTypeLabel,

    // Annotation interaction methods
    handleAnnotationHover: annotationInteractions.handleAnnotationHover,
    handleAnnotationSelect: annotationInteractions.handleAnnotationSelect,
    handleAnnotationClear: annotationInteractions.handleAnnotationClear,

    destroy,
  };
};
