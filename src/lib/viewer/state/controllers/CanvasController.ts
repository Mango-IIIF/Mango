/**
 * CanvasController
 * 
 * Manages canvas (page) selection, navigation, and lifecycle.
 * Handles canvas change effects including state resets.
 */

import { derived, get } from 'svelte/store';
import type { ViewerStateStores } from '../viewerState';
import type { ViewerDerivedStores } from '../viewerDerived';
import { DEFAULT_IMAGE_FILTERS } from '../../../core/types/filters';

export type CanvasControllerConfig = {
  state: ViewerStateStores;
  derived: ViewerDerivedStores;
  emitEvent: <K extends string>(event: K, payload: any) => void;
  emitStateChange: () => void;
  preserveViewport?: boolean; // If true, maintains viewport across canvas changes
};

export type CanvasController = {
  getCanvasIndex: () => number;
  getCanvasId: () => string | null;
  getCanvasCount: () => number;
  setCanvasByIndex: (index: number) => void;
  setCanvasById: (canvasId: string) => void;
  setupCanvasEffects: () => (() => void)[];
};

export const createCanvasController = ({
  state,
  derived: derivedStores,
  emitEvent,
  emitStateChange,
  preserveViewport = false,
}: CanvasControllerConfig): CanvasController => {
  let lastCanvasId = '';
  let lastCanvasIndex = -1;

  const getCanvasIndex = () => get(state.selectedCanvasIndex);

  const getCanvasId = () => {
    const canvases = get(derivedStores.canvases);
    return canvases[get(state.selectedCanvasIndex)]?.id ?? null;
  };

  const getCanvasCount = () => {
    const canvases = get(derivedStores.canvases);
    return canvases.length;
  };

  const setCanvasByIndex = (index: number) => {
    const canvases = get(derivedStores.canvases);
    if (index < 0 || index >= canvases.length) return;
    state.selectedCanvasIndex.set(index);
  };

  const setCanvasById = (canvasId: string) => {
    const canvases = get(derivedStores.canvases);
    const index = canvases.findIndex((canvas) => canvas.id === canvasId);
    if (index >= 0) {
      setCanvasByIndex(index);
    }
  };

  const setupCanvasEffects = (): (() => void)[] => {
    const unsubscribers: Array<() => void> = [];

    // Clamp canvas index when canvases change
    const clampCanvas = derived(
      [derivedStores.canvases, state.selectedCanvasIndex],
      ([canvases, index]) => {
        if (canvases.length > 0 && index >= canvases.length) {
          state.selectedCanvasIndex.set(0);
        }
      },
    );
    unsubscribers.push(clampCanvas.subscribe(() => undefined));

    // Handle canvas change side effects
    const canvasChange = derived(
      [derivedStores.canvases, state.selectedCanvasIndex],
      ([canvases, index]) => {
        const canvas = canvases[index];
        const canvasId = canvas?.id ?? '';
        if (
          canvasId &&
          (canvasId !== lastCanvasId || index !== lastCanvasIndex)
        ) {
          const isInitialLoad = !lastCanvasId;
          lastCanvasId = canvasId;
          lastCanvasIndex = index;
          
          if (!isInitialLoad) {
            // Reset state when canvas changes (unless preserveViewport is enabled)
            state.selectedMediaIndex.set(0);
            state.layerOpacities.set({});
            if (!preserveViewport) {
              state.viewBox.set(null);
              state.zoom.set(0);
              state.rotation.set(0);
              state.imageFilters.set({ ...DEFAULT_IMAGE_FILTERS });
            }
            state.activeAnnotationId.set(null);
            state.hoverAnnotationId.set(null);
            state.mediaTime.set(0);
            state.mediaDuration.set(undefined);
          }
          
          emitEvent('pageChange', { canvasId, index, label: canvas?.label });
          emitStateChange();
        }
      },
    );
    unsubscribers.push(canvasChange.subscribe(() => undefined));

    return unsubscribers;
  };

  return {
    getCanvasIndex,
    getCanvasId,
    getCanvasCount,
    setCanvasByIndex,
    setCanvasById,
    setupCanvasEffects,
  };
};
