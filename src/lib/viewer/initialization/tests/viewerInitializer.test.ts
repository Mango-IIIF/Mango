import { describe, it, expect } from 'vitest';
import {
  createManifestChangeState,
  resolveMediaForCanvas,
  validateCanvasIndex,
  hasManifestChanged,
  resolveInitialViewerState,
} from '../viewerInitializer';
import { DEFAULT_IMAGE_FILTERS } from '../../../core/types/filters';

describe('Viewer Initialization', () => {
  describe('createManifestChangeState', () => {
    it('should create initial state with default values', () => {
      const state = createManifestChangeState();
      
      expect(state.selectedCanvasIndex).toBe(0);
      expect(state.selectedMediaIndex).toBe(0);
      expect(state.viewBox).toBeNull();
      expect(state.zoom).toBe(0);
      expect(state.searchQuery).toBe('');
      expect(state.imageFilters).toEqual(DEFAULT_IMAGE_FILTERS);
    });

    it('should create new filter objects each time', () => {
      const state1 = createManifestChangeState();
      const state2 = createManifestChangeState();
      
      // Should be different objects
      expect(state1.imageFilters).not.toBe(state2.imageFilters);
      // But have same values
      expect(state1.imageFilters).toEqual(state2.imageFilters);
    });
  });

  describe('resolveMediaForCanvas', () => {
    it('should return empty result when no manifest entry', () => {
      const result = resolveMediaForCanvas(undefined, 'canvas-1', 0, 0);
      
      expect(result.mediaSources).toEqual([]);
      expect(result.mediaSource).toBeNull();
      expect(result.mediaType).toBeNull();
    });

    it('should return empty result when manifest has no manifesto', () => {
      const manifestEntry = {
        id: 'test',
        json: {},
        manifesto: null,
        canvases: [],
      } as any;
      
      const result = resolveMediaForCanvas(manifestEntry, 'canvas-1', 0, 0);
      
      expect(result.mediaSources).toEqual([]);
      expect(result.mediaSource).toBeNull();
      expect(result.mediaType).toBeNull();
    });
  });

  describe('validateCanvasIndex', () => {
    it('should return 0 when total canvases is 0', () => {
      expect(validateCanvasIndex(5, 0)).toBe(0);
      expect(validateCanvasIndex(-1, 0)).toBe(0);
    });

    it('should return 0 when index is negative', () => {
      expect(validateCanvasIndex(-1, 10)).toBe(0);
      expect(validateCanvasIndex(-5, 10)).toBe(0);
    });

    it('should return 0 when index is out of bounds', () => {
      expect(validateCanvasIndex(10, 5)).toBe(0);
      expect(validateCanvasIndex(100, 5)).toBe(0);
    });

    it('should return same index when valid', () => {
      expect(validateCanvasIndex(0, 5)).toBe(0);
      expect(validateCanvasIndex(2, 5)).toBe(2);
      expect(validateCanvasIndex(4, 5)).toBe(4);
    });
  });

  describe('hasManifestChanged', () => {
    it('should return false when current manifest is empty', () => {
      expect(hasManifestChanged('', 'manifest-1')).toBe(false);
      expect(hasManifestChanged('', '')).toBe(false);
    });

    it('should return false when manifests are the same', () => {
      expect(hasManifestChanged('manifest-1', 'manifest-1')).toBe(false);
    });

    it('should return true when manifests are different', () => {
      expect(hasManifestChanged('manifest-2', 'manifest-1')).toBe(true);
      expect(hasManifestChanged('manifest-1', '')).toBe(true);
    });
  });

  describe('resolveInitialViewerState', () => {
    it('applies every configured initial state option', () => {
      expect(
        resolveInitialViewerState({
          initialCanvasIndex: 3,
          initialLayoutMode: 'two-page',
          initialRotation: 90,
          initialViewBox: { x: 10, y: 20, w: 300, h: 200 },
        }),
      ).toEqual({
        selectedCanvasIndex: 3,
        layoutMode: 'two-page',
        rotation: 90,
        viewBox: { x: 10, y: 20, w: 300, h: 200 },
      });
    });

    it('uses URL canvas, rotation, and view box values before config defaults', () => {
      expect(
        resolveInitialViewerState(
          {
            initialCanvasIndex: 1,
            initialRotation: 90,
            initialViewBox: { x: 1, y: 2, w: 3, h: 4 },
          },
          { canvasIndex: 4, rotation: 180, xywh: '20,30,400,500' },
        ),
      ).toMatchObject({
        selectedCanvasIndex: 4,
        rotation: 180,
        viewBox: { x: 20, y: 30, w: 400, h: 500 },
      });
    });

    it('rejects invalid initial values', () => {
      expect(
        resolveInitialViewerState({
          initialCanvasIndex: -2,
          initialRotation: Number.NaN,
          initialViewBox: { x: 0, y: 0, w: 0, h: 10 },
        }),
      ).toEqual({
        selectedCanvasIndex: 0,
        layoutMode: 'single',
        rotation: 0,
        viewBox: null,
      });
    });
  });
});
