import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { DEFAULT_IMAGE_FILTERS } from '../../../core/types/filters';
import { resetManifestScopedState } from '../viewerController';
import { createViewerState } from '../viewerState';

describe('viewerController manifest transitions', () => {
  it('clears state owned by the previous manifest without changing panel preferences', () => {
    const state = createViewerState({
      selectedCanvasIndex: 3,
      layoutMode: 'continuous',
      rotation: 90,
      viewBox: { x: 1, y: 2, w: 3, h: 4 },
    });

    state.selectedMediaIndex.set(2);
    state.layerOpacities.set({ layer: 0.5 });
    state.searchQuery.set('previous query');
    state.selectedSearchResultId.set('search-result');
    state.iiifSearchResults.set([{ id: 'search-result' } as never]);
    state.imageFilters.set({
      ...DEFAULT_IMAGE_FILTERS,
      brightness: 75,
    });
    state.annotationMode.set('create');
    state.activeAnnotationId.set('active-annotation');
    state.hoverAnnotationId.set('hover-annotation');
    state.mediaTime.set(42);
    state.mediaDuration.set(120);
    state.externalAnnotations.set({ canvas: [] });
    state.userAnnotations.set({ canvas: [] });
    state.showMetadata.set(true);
    state.showContents.set(true);

    resetManifestScopedState(state, { resetViewport: true });

    expect(get(state.selectedCanvasIndex)).toBe(0);
    expect(get(state.selectedMediaIndex)).toBe(0);
    expect(get(state.layoutMode)).toBe('single');
    expect(get(state.viewBox)).toBeNull();
    expect(get(state.zoom)).toBe(0);
    expect(get(state.rotation)).toBe(0);
    expect(get(state.layerOpacities)).toEqual({});
    expect(get(state.searchQuery)).toBe('');
    expect(get(state.selectedSearchResultId)).toBeNull();
    expect(get(state.iiifSearchResults)).toEqual([]);
    expect(get(state.imageFilters)).toEqual(DEFAULT_IMAGE_FILTERS);
    expect(get(state.annotationMode)).toBe('edit');
    expect(get(state.activeAnnotationId)).toBeNull();
    expect(get(state.hoverAnnotationId)).toBeNull();
    expect(get(state.mediaTime)).toBe(0);
    expect(get(state.mediaDuration)).toBeUndefined();
    expect(get(state.externalAnnotations)).toEqual({});
    expect(get(state.userAnnotations)).toEqual({});

    // Visibility is governed by resource availability, not hard-coded here.
    expect(get(state.showMetadata)).toBe(true);
    expect(get(state.showContents)).toBe(true);
  });

  it('preserves an explicitly requested initial viewport', () => {
    const initialViewBox = { x: 1, y: 2, w: 3, h: 4 };
    const state = createViewerState({
      selectedCanvasIndex: 2,
      layoutMode: 'two-page',
      rotation: 180,
      viewBox: initialViewBox,
    });

    resetManifestScopedState(state, { resetViewport: false });

    expect(get(state.selectedCanvasIndex)).toBe(2);
    expect(get(state.layoutMode)).toBe('two-page');
    expect(get(state.rotation)).toBe(180);
    expect(get(state.viewBox)).toEqual(initialViewBox);
  });
});
