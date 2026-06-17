import { describe, it, expect } from 'vitest';
import {
  createManifestChangeState,
  resolveMediaForCanvas,
  validateCanvasIndex,
  hasManifestChanged,
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
});
