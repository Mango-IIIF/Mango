import { describe, it, expect } from 'vitest';
import { getRendererCapabilities } from '../rendererRegistry';
import type { MediaType } from '../../iiif/mediaResolver';

describe('Renderer Capabilities', () => {
  it('should return image renderer capabilities', () => {
    const caps = getRendererCapabilities('image');
    
    expect(caps.supportsZoom).toBe(true);
    expect(caps.supportsFilters).toBe(true);
    expect(caps.supportsPan).toBe(true);
    expect(caps.supportsViewBox).toBe(true);
    expect(caps.supportsRotation).toBe(true);
    expect(caps.isInteractive).toBe(true);
  });

  it('should return video renderer capabilities', () => {
    const caps = getRendererCapabilities('video');
    
    expect(caps.supportsZoom).toBe(false);
    expect(caps.supportsFilters).toBe(false);
    expect(caps.supportsPan).toBe(false);
    expect(caps.supportsViewBox).toBe(false);
    expect(caps.supportsRotation).toBe(false);
    expect(caps.isInteractive).toBe(true);
  });

  it('should return audio renderer capabilities', () => {
    const caps = getRendererCapabilities('audio');
    
    expect(caps.supportsZoom).toBe(false);
    expect(caps.supportsFilters).toBe(false);
    expect(caps.supportsPan).toBe(false);
    expect(caps.supportsViewBox).toBe(false);
    expect(caps.supportsRotation).toBe(false);
    expect(caps.isInteractive).toBe(true);
  });

  it('should return pdf renderer capabilities', () => {
    const caps = getRendererCapabilities('pdf');
    
    expect(caps.supportsZoom).toBe(true);
    expect(caps.supportsFilters).toBe(false);
    expect(caps.supportsPan).toBe(true);
    expect(caps.supportsViewBox).toBe(true);
    expect(caps.supportsRotation).toBe(false);
    expect(caps.isInteractive).toBe(true);
  });

  it('should return model renderer capabilities', () => {
    const caps = getRendererCapabilities('model');
    
    expect(caps.supportsZoom).toBe(false);  // Uses camera orbit
    expect(caps.supportsFilters).toBe(false);
    expect(caps.supportsPan).toBe(false);  // Uses camera orbit
    expect(caps.supportsViewBox).toBe(false);
    expect(caps.supportsRotation).toBe(true);  // 3D rotation
    expect(caps.isInteractive).toBe(true);
  });

  it('should have consistent capability types across renderers', () => {
    const types: MediaType[] = ['image', 'video', 'audio', 'pdf', 'model'];
    
    types.forEach(type => {
      const caps = getRendererCapabilities(type);
      
      // Check all expected properties exist
      expect(caps).toHaveProperty('supportsZoom');
      expect(caps).toHaveProperty('supportsFilters');
      expect(caps).toHaveProperty('supportsPan');
      expect(caps).toHaveProperty('supportsViewBox');
      expect(caps).toHaveProperty('supportsRotation');
      expect(caps).toHaveProperty('isInteractive');
      
      // Check all properties are booleans
      expect(typeof caps.supportsZoom).toBe('boolean');
      expect(typeof caps.supportsFilters).toBe('boolean');
      expect(typeof caps.supportsPan).toBe('boolean');
      expect(typeof caps.supportsViewBox).toBe('boolean');
      expect(typeof caps.supportsRotation).toBe('boolean');
      expect(typeof caps.isInteractive).toBe('boolean');
    });
  });

  it('should identify image renderer as most capable', () => {
    const imageCaps = getRendererCapabilities('image');
    const videoCaps = getRendererCapabilities('video');
    const audioCaps = getRendererCapabilities('audio');
    
    // Count true capabilities
    const countCapabilities = (caps: typeof imageCaps) =>
      Object.values(caps).filter(v => v === true).length;
    
    expect(countCapabilities(imageCaps)).toBeGreaterThan(countCapabilities(videoCaps));
    expect(countCapabilities(imageCaps)).toBeGreaterThan(countCapabilities(audioCaps));
  });
});
