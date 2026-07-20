import { get, writable } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { createViewerDerived } from '../viewerDerived';
import { createViewerState, type ViewerStateStores } from '../viewerState';
import { createPanelController } from '../controllers/PanelController';

const leftPanelState = (state: ViewerStateStores) => ({
  collection: get(state.showCollection),
  contents: get(state.showContents),
  annotations: get(state.showAnnotations),
  tools: get(state.showTools),
  settings: get(state.showSettings),
  search: get(state.showSearch),
  metadata: get(state.showMetadata),
  layers: get(state.showLayers),
});

describe('PanelController', () => {
  it('starts with every left panel closed when sidebar.open is false', () => {
    const state = createViewerState({ config: { sidebar: { open: false } } });
    const derived = createViewerDerived(state);
    createPanelController({
      state,
      derived,
      emitEvent: vi.fn(),
      emitStateChange: vi.fn(),
      initialOpen: false,
    });

    expect(leftPanelState(state)).toEqual({
      collection: false,
      contents: false,
      annotations: false,
      tools: false,
      settings: false,
      search: false,
      metadata: false,
      layers: false,
    });
  });

  it('selects the configured active panel when it is available', () => {
    const state = createViewerState({
      config: { sidebar: { activePanel: 'search' } },
    });
    const derived = {
      ...createViewerDerived(state),
      allowSearch: writable(true),
    };
    createPanelController({
      state,
      derived,
      emitEvent: vi.fn(),
      emitStateChange: vi.fn(),
      initialActivePanel: 'search',
    });

    expect(get(state.showSearch)).toBe(true);
    expect(get(state.showMetadata)).toBe(false);
  });

  it('does not reopen the last left panel when permissions change after all left panels are closed', () => {
    const state = createViewerState({ config: {} });
    const derived = createViewerDerived(state);
    const controller = createPanelController({
      state,
      derived,
      emitEvent: vi.fn(),
      emitStateChange: vi.fn(),
    });
    const unsubscribers = controller.setupPanelEffects();

    try {
      expect(get(state.showMetadata)).toBe(true);

      controller.setPanelOpen('metadata', false);
      expect(leftPanelState(state)).toEqual({
        collection: false,
        contents: false,
        annotations: false,
        tools: false,
        settings: false,
        search: false,
        metadata: false,
        layers: false,
      });

      state.config.set({ showMetadata: false });
      state.config.set({});

      expect(leftPanelState(state)).toEqual({
        collection: false,
        contents: false,
        annotations: false,
        tools: false,
        settings: false,
        search: false,
        metadata: false,
        layers: false,
      });
    } finally {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    }
  });

  it('opens collection navigation when collection data is available', () => {
    const state = createViewerState({ config: {} });
    state.collectionId.set('collection');
    const derived = {
      ...createViewerDerived(state),
      allowCollection: writable(true),
    };
    const controller = createPanelController({
      state,
      derived,
      emitEvent: vi.fn(),
      emitStateChange: vi.fn(),
    });

    controller.setPanelOpen('collection', true);

    expect(get(state.showCollection)).toBe(true);
    expect(get(state.showMetadata)).toBe(false);
  });

  it('closes collection and layer panels when the new manifest makes them unavailable', () => {
    const state = createViewerState({ config: {} });
    const allowCollection = writable(true);
    const allowLayers = writable(true);
    const derived = {
      ...createViewerDerived(state),
      allowCollection,
      allowLayers,
    };
    const controller = createPanelController({
      state,
      derived,
      emitEvent: vi.fn(),
      emitStateChange: vi.fn(),
    });
    const unsubscribers = controller.setupPanelEffects();

    try {
      controller.setPanelOpen('collection', true);
      expect(get(state.showCollection)).toBe(true);

      allowCollection.set(false);
      expect(get(state.showCollection)).toBe(false);

      controller.setPanelOpen('layers', true);
      expect(get(state.showLayers)).toBe(true);

      allowLayers.set(false);
      expect(get(state.showLayers)).toBe(false);
    } finally {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    }
  });
});
