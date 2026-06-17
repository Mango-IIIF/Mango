import { describe, it, expect } from 'vitest';
import {
  parseURLHash,
  parseTarget,
  parseContentState,
  serializeURLState,
  createTarget,
  type URLStateParams,
} from '../URLStateManager';
import { XYWHFragment } from '../XYWHFragment';

// Helper to encode content-state to base64url
function encodeContentState(obj: any): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_');
}

describe('URLStateManager', () => {
  describe('parseURLHash', () => {
    it('should parse manifest parameter', () => {
      const result = parseURLHash('#manifest=https://example.com/manifest.json');
      expect(result.manifestId).toBe('https://example.com/manifest.json');
    });

    it('should parse canvas index', () => {
      const result = parseURLHash('#cv=5');
      expect(result.canvasIndex).toBe(5);
    });

    it('should parse xywh parameter', () => {
      const result = parseURLHash('#xywh=100,200,300,400');
      expect(result.xywh).toBe('100,200,300,400');
    });

    it('should parse rotation with r parameter', () => {
      const result = parseURLHash('#r=90');
      expect(result.rotation).toBe(90);
    });

    it('should parse rotation with rotation parameter', () => {
      const result = parseURLHash('#rotation=180');
      expect(result.rotation).toBe(180);
    });

    it('should parse target parameter', () => {
      const result = parseURLHash('#target=canvas1%23xywh%3D10,20,30,40');
      expect(result.target).toBeDefined();
    });

    it('should parse multiple parameters', () => {
      const result = parseURLHash('#manifest=test.json&cv=2&xywh=10,20,30,40&r=90');
      expect(result.manifestId).toBe('test.json');
      expect(result.canvasIndex).toBe(2);
      expect(result.xywh).toBe('10,20,30,40');
      expect(result.rotation).toBe(90);
    });

    it('should handle empty hash', () => {
      const result = parseURLHash('');
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('parseTarget', () => {
    it('should parse canvas ID only', () => {
      const result = parseTarget('canvas1');
      expect(result).toEqual({ canvasId: 'canvas1' });
    });

    it('should parse canvas ID with xywh', () => {
      const result = parseTarget('canvas1#xywh=100,200,300,400');
      expect(result).toEqual({
        canvasId: 'canvas1',
        xywh: '100,200,300,400',
      });
    });

    it('should parse canvas ID with bare coordinates', () => {
      const result = parseTarget('canvas1#100,200,300,400');
      expect(result).toEqual({
        canvasId: 'canvas1',
        xywh: '100,200,300,400',
      });
    });

    it('should handle URL-encoded target', () => {
      const result = parseTarget('https://example.com/canvas/1#xywh=10,20,30,40');
      expect(result?.canvasId).toBe('https://example.com/canvas/1');
      expect(result?.xywh).toBe('10,20,30,40');
    });

    it('should return null for empty target', () => {
      const result = parseTarget('');
      expect(result).toBeNull();
    });
  });

  describe('parseContentState', () => {
    it('should parse valid content-state with BoxSelector', () => {
      // Create a simple content-state token
      const contentState = {
        '@context': 'http://iiif.io/api/presentation/3/context.json',
        type: 'Annotation',
        target: {
          type: 'SpecificResource',
          source: {
            id: 'https://example.com/canvas/1',
            type: 'Canvas',
          },
          selector: {
            type: 'BoxSelector',
            spatial: {
              x: 100,
              y: 200,
              width: 300,
              height: 400,
            },
          },
        },
      };
      const token = encodeContentState(contentState);
      
      const result = parseContentState(token);
      expect(result).toEqual({
        canvasId: 'https://example.com/canvas/1',
        xywh: '100,200,300,400',
      });
    });

    it('should parse content-state with FragmentSelector', () => {
      const contentState = {
        type: 'Annotation',
        target: {
          type: 'SpecificResource',
          source: {
            id: 'canvas1',
          },
          selector: {
            type: 'FragmentSelector',
            value: 'xywh=10,20,30,40',
          },
        },
      };
      const token = encodeContentState(contentState);
      
      const result = parseContentState(token);
      expect(result).toEqual({
        canvasId: 'canvas1',
        xywh: '10,20,30,40',
      });
    });

    it('should handle invalid token gracefully', () => {
      const result = parseContentState('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('serializeURLState', () => {
    it('should serialize manifest', () => {
      const params: URLStateParams = {
        manifestId: 'https://example.com/manifest.json',
      };
      const result = serializeURLState(params);
      expect(result).toBe('#manifest=https%3A%2F%2Fexample.com%2Fmanifest.json');
    });

    it('should serialize multiple parameters', () => {
      const params: URLStateParams = {
        manifestId: 'test.json',
        canvasIndex: 2,
        xywh: '10,20,30,40',
        rotation: 90,
      };
      const result = serializeURLState(params);
      expect(result).toContain('manifest=test.json');
      expect(result).toContain('cv=2');
      expect(result).toContain('xywh=10%2C20%2C30%2C40');
      expect(result).toContain('r=90');
    });

    it('should skip rotation when 0', () => {
      const params: URLStateParams = {
        rotation: 0,
      };
      const result = serializeURLState(params);
      expect(result).not.toContain('r=');
    });

    it('should return empty hash for empty params', () => {
      const params: URLStateParams = {};
      const result = serializeURLState(params);
      expect(result).toBe('');
    });
  });

  describe('createTarget', () => {
    it('should create target from string xywh', () => {
      const result = createTarget('canvas1', '100,200,300,400');
      expect(result).toBe('canvas1#xywh=100,200,300,400');
    });

    it('should create target from XYWHFragment', () => {
      const xywh = new XYWHFragment(100, 200, 300, 400);
      const result = createTarget('canvas1', xywh);
      expect(result).toBe('canvas1#xywh=100,200,300,400');
    });
  });
});
