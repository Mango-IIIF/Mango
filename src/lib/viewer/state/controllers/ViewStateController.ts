/**
 * ViewStateController
 *
 * Manages view state including viewBox, zoom, and image filters.
 * Handles user interactions with the view rendering.
 */

import { get } from "svelte/store";
import type { ViewBox } from "../../../core/types/viewer";
import type { ImageFilters } from "../../../core/types/filters";
import { DEFAULT_IMAGE_FILTERS } from "../../../core/types/filters";
import type { ViewerStateStores } from "../viewerState";
import type { ViewerEventEmitter } from "../../../core/types/events";

export type ViewStateControllerConfig = {
  state: ViewerStateStores;
  emitEvent: ViewerEventEmitter;
  applyViewBox: (viewBox: ViewBox) => void;
};

export type ViewStateController = {
  handleViewBoxChange: (detail: { viewBox: ViewBox }) => void;
  handleZoomChange: (detail: { zoom: number; viewBox: ViewBox }) => void;
  handleRotationChange: (detail: { rotation: number }) => void;
  updateImageFilter: <K extends keyof ImageFilters>(
    key: K,
    value: ImageFilters[K],
  ) => void;
  resetImageFilters: () => void;
  setPendingViewBox: (viewBox: ViewBox | null) => void;
  getPendingViewBox: () => ViewBox | null;
  setRotation: (rotation: number) => void;
  getRotation: () => number;
};

export const createViewStateController = ({
  state,
  emitEvent,
  applyViewBox,
}: ViewStateControllerConfig): ViewStateController => {
  let pendingViewBox: ViewBox | null = null;

  const handleViewBoxChange = (detail: { viewBox: ViewBox }) => {
    // If we have a pending viewBox (from a search result click that triggered navigation),
    // apply it now that the image is loaded
    if (pendingViewBox) {
      const targetViewBox = pendingViewBox;
      pendingViewBox = null;

      // Use a small delay to ensure the renderer is fully ready
      setTimeout(() => {
        state.viewBox.set(targetViewBox);
        applyViewBox(targetViewBox);
        emitEvent("viewBoxChange", { viewBox: targetViewBox });
      }, 100);
      return;
    }

    state.viewBox.set(detail.viewBox);
    emitEvent("viewBoxChange", detail);
  };

  const handleZoomChange = (detail: { zoom: number; viewBox: ViewBox }) => {
    state.zoom.set(detail.zoom);
    emitEvent("zoomChange", detail);
  };

  const handleRotationChange = (detail: { rotation: number }) => {
    state.rotation.set(detail.rotation);
    emitEvent("rotationChange", detail);
  };

  const setRotation = (rotation: number) => {
    state.rotation.set(rotation);
  };

  const getRotation = () => get(state.rotation);

  const updateImageFilter = <K extends keyof ImageFilters>(
    key: K,
    value: ImageFilters[K],
  ) => {
    state.imageFilters.update((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetImageFilters = () => {
    state.imageFilters.set({ ...DEFAULT_IMAGE_FILTERS });
  };

  const setPendingViewBox = (viewBox: ViewBox | null) => {
    pendingViewBox = viewBox;
  };

  const getPendingViewBox = () => pendingViewBox;

  return {
    handleViewBoxChange,
    handleZoomChange,
    handleRotationChange,
    updateImageFilter,
    resetImageFilters,
    setPendingViewBox,
    getPendingViewBox,
    setRotation,
    getRotation,
  };
};
