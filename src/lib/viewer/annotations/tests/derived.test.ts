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

describe('read-only annotation overrides', () => {
  const canvasId = 'canvas-1';
  const canvases = [{ id: canvasId, index: 0 }];

  const makeStores = () => {
    const canvas = { id: canvasId, getAnnotations: () => [], getOtherContent: () => [] };
    const manifestEntry = writable({
      id: 'manifest-1',
      manifesto: { getSequences: () => [{ getCanvases: () => [canvas] }] },
      canvases,
      isFetching: false,
    });
    const state = createViewerState();
    state.externalAnnotations.set({
      [canvasId]: [
        { id: 'external-1', text: 'First' },
        { id: 'external-2', text: 'Second' },
        { id: 'external-3', text: 'Third' },
      ],
    });
    const stores = createAnnotationDerivedStores({
      manifestEntry,
      canvases: writable(canvases),
      state,
    });
    return { state, stores };
  };

  it('replaces an external annotation in place with the user copy', () => {
    const { state, stores } = makeStores();

    // In place, so an edit does not move the annotation to the end of the list
    // and renumber every "N of 35" counter around it.
    state.userAnnotations.set({ [canvasId]: [{ id: 'external-2', text: 'Edited' }] });

    expect(get(stores.annotations).map((item) => item.id)).toEqual([
      'external-1',
      'external-2',
      'external-3',
    ]);
    expect(get(stores.annotations)[1].text).toBe('Edited');
  });

  it('appends user annotations that have no source counterpart', () => {
    const { state, stores } = makeStores();

    state.userAnnotations.set({ [canvasId]: [{ id: 'user-1', text: 'Mine' }] });

    expect(get(stores.annotations).map((item) => item.id)).toEqual([
      'external-1',
      'external-2',
      'external-3',
      'user-1',
    ]);
  });

  it('honours a tombstone over both the source and its user copy', () => {
    const { state, stores } = makeStores();

    state.userAnnotations.set({ [canvasId]: [{ id: 'external-2', text: 'Edited' }] });
    state.removedAnnotationIds.set({ [canvasId]: ['external-2'] });

    expect(get(stores.annotations).map((item) => item.id)).toEqual([
      'external-1',
      'external-3',
    ]);
  });

  it('applies the same overrides to the cross-canvas list search reads', () => {
    const { state, stores } = makeStores();

    state.userAnnotations.set({ [canvasId]: [{ id: 'external-1', text: 'Edited' }] });
    state.removedAnnotationIds.set({ [canvasId]: ['external-3'] });
    state.showSearch.set(true);
    state.searchQuery.set('Edited');

    expect(get(stores.searchHits).map((item) => item.id)).toEqual(['external-1']);

    state.searchQuery.set('Third');
    expect(get(stores.searchHits)).toEqual([]);
  });
});
