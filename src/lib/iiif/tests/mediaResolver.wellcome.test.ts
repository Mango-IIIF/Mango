import { describe, it, expect } from 'vitest';
import * as manifesto from 'manifesto.js';
import { resolveMedia } from '../mediaResolver';

/**
 * This test uses a structure based on the real Wellcome Collection manifest:
 * https://iiif.wellcomecollection.org/presentation/v2/b18035723
 * 
 * Real IIIF v2 manifests from institutions like Wellcome Collection have:
 * - More complete metadata
 * - Multiple canvases with real image services
 * - Proper IIIF Image API service blocks
 * - Thumbnails on both manifest and canvas level
 * - License and attribution information
 */
const wellcomeStyleManifestJson = {
  '@context': 'http://iiif.io/api/presentation/2/context.json',
  '@id': 'https://wellcomecollection.org/works/b18035723/manifest',
  '@type': 'sc:Manifest',
  label: 'Medical heritage library',
  metadata: [
    {
      label: 'Title',
      value: 'Medical heritage library',
    },
    {
      label: 'Attribution',
      value: 'Wellcome Collection',
    },
  ],
  license: 'https://creativecommons.org/licenses/by/4.0/',
  logo: 'https://wellcomecollection.org/assets/icons/wellcome-collection-black.svg',
  thumbnail: {
    '@id': 'https://iiif.wellcomecollection.org/thumbs/b18035723.jpg',
    service: {
      '@context': 'http://iiif.io/api/image/2/context.json',
      '@id': 'https://iiif.wellcomecollection.org/thumbs/b18035723.jpg',
      profile: 'http://iiif.io/api/image/2/level0.json',
    },
  },
  sequences: [
    {
      '@type': 'sc:Sequence',
      canvases: [
        {
          '@id': 'https://wellcomecollection.org/works/b18035723/items/canvas/b18035724',
          '@type': 'sc:Canvas',
          label: 'Page 1',
          width: 2090,
          height: 3072,
          thumbnail: {
            '@id':
              'https://iiif.wellcomecollection.org/image/b18035724.jp2/full/200,/0/default.jpg',
            service: {
              '@context': 'http://iiif.io/api/image/2/context.json',
              '@id': 'https://iiif.wellcomecollection.org/image/b18035724.jp2',
              profile: 'http://iiif.io/api/image/2/level1.json',
            },
          },
          images: [
            {
              '@type': 'oa:Annotation',
              motivation: 'sc:painting',
              resource: {
                '@id':
                  'https://iiif.wellcomecollection.org/image/b18035724.jp2/full/full/0/default.jpg',
                '@type': 'dctypes:Image',
                format: 'image/jpeg',
                width: 2090,
                height: 3072,
                service: {
                  '@context': 'http://iiif.io/api/image/2/context.json',
                  '@id': 'https://iiif.wellcomecollection.org/image/b18035724.jp2',
                  profile: 'http://iiif.io/api/image/2/level1.json',
                },
              },
              on: 'https://wellcomecollection.org/works/b18035723/items/canvas/b18035724',
            },
          ],
        },
        {
          '@id': 'https://wellcomecollection.org/works/b18035723/items/canvas/b18035725',
          '@type': 'sc:Canvas',
          label: 'Page 2',
          width: 2090,
          height: 3072,
          thumbnail: {
            '@id':
              'https://iiif.wellcomecollection.org/image/b18035725.jp2/full/200,/0/default.jpg',
            service: {
              '@context': 'http://iiif.io/api/image/2/context.json',
              '@id': 'https://iiif.wellcomecollection.org/image/b18035725.jp2',
              profile: 'http://iiif.io/api/image/2/level1.json',
            },
          },
          images: [
            {
              '@type': 'oa:Annotation',
              motivation: 'sc:painting',
              resource: {
                '@id':
                  'https://iiif.wellcomecollection.org/image/b18035725.jp2/full/full/0/default.jpg',
                '@type': 'dctypes:Image',
                format: 'image/jpeg',
                width: 2090,
                height: 3072,
                service: {
                  '@context': 'http://iiif.io/api/image/2/context.json',
                  '@id': 'https://iiif.wellcomecollection.org/image/b18035725.jp2',
                  profile: 'http://iiif.io/api/image/2/level1.json',
                },
              },
              on: 'https://wellcomecollection.org/works/b18035723/items/canvas/b18035725',
            },
          ],
        },
      ],
    },
  ],
};

describe('resolveMedia with Wellcome Collection style v2 manifest', () => {
  it('should parse Wellcome Collection manifest structure', () => {
    const manifestoObject = manifesto.parseManifest(wellcomeStyleManifestJson);
    expect(manifestoObject).toBeTruthy();

    // Verify basic structure
    expect(manifestoObject.getLabel().getValue()).toBe('Medical heritage library');
    
    const sequences = manifestoObject.getSequences();
    expect(sequences.length).toBe(1);
    
    const canvases = sequences[0].getCanvases();
    expect(canvases.length).toBe(2);
    
    // Verify first canvas
    const canvas1 = canvases[0];
    expect(canvas1.getWidth()).toBe(2090);
    expect(canvas1.getHeight()).toBe(3072);
    
    // Verify images exist
    const images = canvas1.getImages();
    expect(images.length).toBe(1);
    
    // Verify resource is accessible via getResource() (v2 API)
    const image = images[0];
    expect(typeof image.getResource).toBe('function');
    const resource = image.getResource();
    expect(resource).toBeTruthy();
    
    // Verify resource has service
    const service = resource.getProperty('service');
    expect(service).toBeTruthy();
    expect(service['@id']).toContain('wellcomecollection.org');
  });

  it('should resolve media from Wellcome Collection canvas', () => {
    const manifestoObject = manifesto.parseManifest(wellcomeStyleManifestJson);
    
    // Test first canvas
    const result1 = resolveMedia(
      manifestoObject,
      'https://wellcomecollection.org/works/b18035723/items/canvas/b18035724',
      0
    );
    
    expect(result1.primary).toBeTruthy();
    expect(result1.primary?.type).toBe('image');
    expect(result1.primary?.src).toBe(
      'https://iiif.wellcomecollection.org/image/b18035724.jp2/info.json'
    );
    expect(result1.primary?.width).toBe(2090);
    expect(result1.primary?.height).toBe(3072);
    expect(result1.primary?.format).toBe('image/jpeg');
    
    // Test second canvas
    const result2 = resolveMedia(
      manifestoObject,
      'https://wellcomecollection.org/works/b18035723/items/canvas/b18035725',
      1
    );
    
    expect(result2.primary).toBeTruthy();
    expect(result2.primary?.type).toBe('image');
    expect(result2.primary?.src).toBe(
      'https://iiif.wellcomecollection.org/image/b18035725.jp2/info.json'
    );
  });

  it('should handle thumbnails from Wellcome Collection manifest', () => {
    const manifestoObject = manifesto.parseManifest(wellcomeStyleManifestJson);
    const sequences = manifestoObject.getSequences();
    const canvas = sequences[0].getCanvases()[0];
    
    // Wellcome Collection provides thumbnails on canvases
    const thumbnail = canvas.getProperty('thumbnail');
    expect(thumbnail).toBeTruthy();
    expect(thumbnail['@id']).toContain('full/200,/0/default.jpg');
    expect(thumbnail.service).toBeTruthy();
    expect(thumbnail.service['@id']).toContain('b18035724.jp2');
  });

  it('should handle manifest-level metadata from Wellcome Collection', () => {
    const manifestoObject = manifesto.parseManifest(wellcomeStyleManifestJson);
    
    // Verify metadata is accessible
    const metadata = manifestoObject.getMetadata();
    expect(metadata.length).toBeGreaterThan(0);
    
    // Verify licence
    const licence = manifestoObject.getProperty('license');
    expect(licence).toBe('https://creativecommons.org/licenses/by/4.0/');
    
    // Verify logo
    const logo = manifestoObject.getProperty('logo');
    expect(logo).toContain('wellcome-collection-black.svg');
  });
});
