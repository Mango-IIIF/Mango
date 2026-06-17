import { describe, expect, it, vi } from 'vitest';
import type { ViewerApi } from '../../core/types/viewer-api';
import { animateLayerOpacities } from '../viewBoxAnimation';

const createMockViewer = (overrides: Partial<ViewerApi> = {}): ViewerApi => ({
  getViewBox: () => ({ x: 0, y: 0, w: 100, h: 100 }),
  setViewBox: () => undefined,
  getMediaType: () => 'image',
  getState: () => null,
  getCanvasIndex: () => 0,
  getCanvasId: () => 'canvas-1',
  setCanvasByIndex: () => undefined,
  setCanvasById: () => undefined,
  setManifest: () => undefined,
  getManifestId: () => 'manifest-1',
  setModelOrbit: () => undefined,
  setModelTarget: () => undefined,
  setModelOrientation: () => undefined,
  addAnnotation: () => Promise.resolve(),
  removeAnnotation: () => Promise.resolve(),
  updateLayerOpacity: () => undefined,
  getLayerOpacities: () => ({}),
  getMediaSources: () => [
    { id: 'layer-1', type: 'image', label: 'Base Layer' },
    { id: 'layer-2', type: 'image', label: 'Layer 2' },
  ],
  on: () => () => undefined,
  off: () => undefined,
  ...overrides,
});

describe('animateLayerOpacities', () => {
  it('updates layer opacities immediately if requestAnimationFrame is not supported', () => {
    const opacityUpdates: Record<string, number> = {};
    const mockViewer = createMockViewer({
      updateLayerOpacity: (id, opacity) => {
        opacityUpdates[id] = opacity;
      },
    });

    const originalRaf = (globalThis as any).requestAnimationFrame;
    delete (globalThis as any).requestAnimationFrame;

    try {
      const cancel = animateLayerOpacities(
        mockViewer,
        { 'layer-1': 1.0, 'layer-2': 0.0 },
        { 'layer-1': 0.5, 'layer-2': 0.8 },
        500,
        { requestAnimationFrame: undefined } // force immediate fallback
      );

      expect(opacityUpdates['layer-1']).toBe(0.5);
      expect(opacityUpdates['layer-2']).toBe(0.8);
      cancel();
    } finally {
      (globalThis as any).requestAnimationFrame = originalRaf;
    }
  });

  it('smoothly interpolates opacities using requestAnimationFrame', () => {
    const opacityUpdates: Record<string, number[]> = {
      'layer-1': [],
      'layer-2': [],
    };
    const mockViewer = createMockViewer({
      updateLayerOpacity: (id, opacity) => {
        if (!opacityUpdates[id]) opacityUpdates[id] = [];
        opacityUpdates[id].push(opacity);
      },
    });

    let frameCallback: FrameRequestCallback | null = null;
    const rAF = (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    };
    const cAF = vi.fn();

    let currentTime = 1000;
    const now = () => currentTime;

    const cancel = animateLayerOpacities(
      mockViewer,
      { 'layer-1': 1.0, 'layer-2': 0.0 },
      { 'layer-1': 0.0, 'layer-2': 1.0 },
      1000,
      { now, requestAnimationFrame: rAF, cancelAnimationFrame: cAF }
    );

    // Initial rAF trigger should register step
    expect(frameCallback).toBeDefined();

    // Trigger step at 50% elapsed (500ms)
    currentTime = 1500;
    if (frameCallback) {
      (frameCallback as FrameRequestCallback)(1500);
    }

    // easeInOutQuad at 50% progress (t=0.5) is 0.5
    // so layer-1: 1.0 -> 0.5; layer-2: 0.0 -> 0.5
    expect(opacityUpdates['layer-1'][opacityUpdates['layer-1'].length - 1]).toBeCloseTo(0.5);
    expect(opacityUpdates['layer-2'][opacityUpdates['layer-2'].length - 1]).toBeCloseTo(0.5);

    // Trigger step at 100% elapsed (1000ms)
    currentTime = 2000;
    if (frameCallback) {
      (frameCallback as FrameRequestCallback)(2000);
    }

    // progress=1.0 -> final targets
    expect(opacityUpdates['layer-1'][opacityUpdates['layer-1'].length - 1]).toBe(0.0);
    expect(opacityUpdates['layer-2'][opacityUpdates['layer-2'].length - 1]).toBe(1.0);

    cancel();
  });

  it('cancels active animation frames on cancel call', () => {
    const mockViewer = createMockViewer();
    const rAF = vi.fn().mockReturnValue(42);
    const cAF = vi.fn();

    const cancel = animateLayerOpacities(
      mockViewer,
      {},
      { 'layer-1': 1.0 },
      1000,
      { requestAnimationFrame: rAF, cancelAnimationFrame: cAF }
    );

    cancel();
    expect(cAF).toHaveBeenCalledWith(42);
  });
});
