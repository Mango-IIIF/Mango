import { describe, it, expect } from 'vitest';
import * as manifesto from 'manifesto.js';
import { resolveMedia } from '../mediaResolver';

const v2ManifestJson = {
  '@context': 'http://iiif.io/api/presentation/2/context.json',
  '@id': 'https://example.org/manifest-v2',
  '@type': 'sc:Manifest',
  sequences: [
    {
      '@type': 'sc:Sequence',
      canvases: [
        {
          '@id': 'https://example.org/canvas/1',
          '@type': 'sc:Canvas',
          width: 1000,
          height: 1500,
          images: [
            {
              '@type': 'oa:Annotation',
              motivation: 'sc:painting',
              resource: {
                '@id': 'https://iiif.io/api/image/2.1/example/reference/flowers/full/full/0/default.jpg',
                '@type': 'dctypes:Image',
                service: {
                  '@context': 'http://iiif.io/api/image/2/context.json',
                  '@id': 'https://iiif.io/api/image/2.1/example/reference/flowers',
                  profile: 'http://iiif.io/api/image/2/level1.json',
                },
              },
              on: 'https://example.org/canvas/1',
            },
          ],
        },
      ],
    },
  ],
};

describe('resolveMedia with v2 manifest', () => {
  it('should debug v2 manifest structure', () => {
    const manifestoObject = manifesto.parseManifest(v2ManifestJson);
    expect(manifestoObject).toBeTruthy();

    const sequences = manifestoObject.getSequences();
    const canvases = sequences[0].getCanvases();
    const canvas = canvases[0];
    
    console.log('Canvas has getImages:', typeof canvas.getImages);
    
    if (typeof canvas.getImages === 'function') {
      const images = canvas.getImages();
      console.log('Images count:', images.length);
      
      if (images.length > 0) {
        const image = images[0];
        console.log('Image methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(image)));
        console.log('Image has getBody:', typeof image.getBody);
        console.log('Image has getResource:', typeof image.getResource);
        
        if (typeof image.getBody === 'function') {
          const body = image.getBody();
          console.log('getBody() result:', body);
          console.log('getBody() type:', typeof body);
          console.log('getBody() is array:', Array.isArray(body));
        }
        
        if (typeof image.getResource === 'function') {
          const resource = image.getResource();
          console.log('getResource() result:', resource);
          console.log('Resource has getProperty:', typeof resource?.getProperty);
          console.log('Resource id:', resource?.id);
          if (resource && typeof resource.getProperty === 'function') {
            console.log('Resource service:', resource.getProperty('service'));
          }
        }
      }
    }
  });
  
  it('should resolve image from v2 manifest', () => {
    const manifestoObject = manifesto.parseManifest(v2ManifestJson);
    expect(manifestoObject).toBeTruthy();

    const result = resolveMedia(manifestoObject, 'https://example.org/canvas/1', 0);
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    expect(result.primary).toBeTruthy();
    expect(result.primary?.type).toBe('image');
    expect(result.primary?.src).toContain('flowers');
  });

  it('should resolve v3 choice manifest', async () => {
    const res = await fetch('https://iiif.io/api/cookbook/recipe/0033-choice/manifest.json');
    const json = await res.json();
    const manifestoObject = manifesto.parseManifest(json);
    const result = resolveMedia(manifestoObject, 'https://iiif.io/api/cookbook/recipe/0033-choice/canvas/p1', 0);
    console.log('V3 CHOICE RESULT:', JSON.stringify(result, null, 2));
  });
});
