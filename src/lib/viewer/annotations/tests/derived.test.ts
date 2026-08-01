import { get, writable } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import type { ResolvedAnnotation } from '../../../iiif/annotationResolver';
import { createViewerState } from '../../state/viewerState';
import { createAnnotationDerivedStores } from '../derived';

describe('annotation overlay visibility', () => {
  it('keeps annotations visible after their panel closes when requested', () => {
    const canvasId = 'canvas-1';
    const canvas = {
      id: canvasId,
      getAnnotations: () => [],
      getOtherContent: () => [],
    };
    const canvases = [{ id: canvasId, index: 0 }];
    const manifestEntry = writable({
      id: 'manifest-1',
      manifesto: {
        getSequences: () => [{ getCanvases: () => [canvas] }],
      },
      canvases,
      isFetching: false,
    });
    const state = createViewerState();
    const annotation: ResolvedAnnotation = {
      id: 'annotation-1',
      text: 'Persistent annotation',
      rect: { x: 10, y: 20, w: 30, h: 40 },
    };
    state.externalAnnotations.set({ [canvasId]: [annotation] });
    const stores = createAnnotationDerivedStores({
      manifestEntry,
      canvases: writable(canvases),
      state,
    });

    expect(get(stores.overlayAnnotations)).toEqual([]);

    state.showAnnotations.set(true);
    expect(get(stores.overlayAnnotations)).toEqual([annotation]);

    state.keepAnnotationsVisible.set(true);
    state.showAnnotations.set(false);
    expect(get(stores.overlayAnnotations)).toEqual([annotation]);

    state.keepAnnotationsVisible.set(false);
    expect(get(stores.overlayAnnotations)).toEqual([]);
  });
});
