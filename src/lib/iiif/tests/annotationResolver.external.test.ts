import { describe, it, expect } from 'vitest';
import * as manifesto from 'manifesto.js';
import { hasExternalAnnotationRefs } from '../annotationResolver';

describe('hasExternalAnnotationRefs', () => {
  it('should detect external annotation URLs in v2 otherContent', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://example.org/manifest-with-external-annotations',
      '@type': 'sc:Manifest',
      label: 'Test Manifest with External Annotations',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases: [
            {
              '@id': 'https://example.org/canvas1',
              '@type': 'sc:Canvas',
              label: 'Canvas 1',
              width: 1000,
              height: 1500,
              images: [
                {
                  '@type': 'oa:Annotation',
                  motivation: 'sc:painting',
                  resource: {
                    '@id': 'https://example.org/image1.jpg',
                    '@type': 'dctypes:Image',
                    width: 1000,
                    height: 1500,
                  },
                  on: 'https://example.org/canvas1',
                },
              ],
              // External annotation URL - this is what we want to detect
              otherContent: [
                {
                  '@id': 'https://example.org/annotations/canvas1',
                  '@type': 'sc:AnnotationList',
                  // No inline items/resources - this is an external reference
                },
              ],
            },
          ],
        },
      ],
    };

    const manifest = manifesto.parseManifest(manifestJson);
    const sequences = manifest.getSequences();
    const canvas = sequences[0].getCanvases()[0];

    const hasExternal = hasExternalAnnotationRefs(canvas);
    expect(hasExternal).toBe(true);
  });

  it('should detect external annotation URLs as strings in v2 otherContent', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://example.org/manifest-with-external-string-urls',
      '@type': 'sc:Manifest',
      label: 'Test Manifest with External URL Strings',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases: [
            {
              '@id': 'https://example.org/canvas1',
              '@type': 'sc:Canvas',
              label: 'Canvas 1',
              width: 1000,
              height: 1500,
              images: [
                {
                  '@type': 'oa:Annotation',
                  motivation: 'sc:painting',
                  resource: {
                    '@id': 'https://example.org/image1.jpg',
                    '@type': 'dctypes:Image',
                  },
                  on: 'https://example.org/canvas1',
                },
              ],
              // External annotation URL as a string - common in Wellcome Collection
              otherContent: ['https://example.org/annotations/canvas1'],
            },
          ],
        },
      ],
    };

    const manifest = manifesto.parseManifest(manifestJson);
    const sequences = manifest.getSequences();
    const canvas = sequences[0].getCanvases()[0];

    const hasExternal = hasExternalAnnotationRefs(canvas);
    expect(hasExternal).toBe(true);
  });

  it('should return false for inline annotations (not external)', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://example.org/manifest-with-inline-annotations',
      '@type': 'sc:Manifest',
      label: 'Test Manifest with Inline Annotations',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases: [
            {
              '@id': 'https://example.org/canvas1',
              '@type': 'sc:Canvas',
              label: 'Canvas 1',
              width: 1000,
              height: 1500,
              images: [
                {
                  '@type': 'oa:Annotation',
                  motivation: 'sc:painting',
                  resource: {
                    '@id': 'https://example.org/image1.jpg',
                    '@type': 'dctypes:Image',
                  },
                  on: 'https://example.org/canvas1',
                },
              ],
              // Inline annotations with resources - not external
              otherContent: [
                {
                  '@id': 'https://example.org/annotations/canvas1',
                  '@type': 'sc:AnnotationList',
                  resources: [
                    {
                      '@type': 'oa:Annotation',
                      motivation: 'oa:commenting',
                      resource: {
                        '@type': 'cnt:ContentAsText',
                        chars: 'This is inline',
                      },
                      on: 'https://example.org/canvas1#xywh=100,100,200,200',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const manifest = manifesto.parseManifest(manifestJson);
    const sequences = manifest.getSequences();
    const canvas = sequences[0].getCanvases()[0];

    const hasExternal = hasExternalAnnotationRefs(canvas);
    // Should return false because annotations are inline (have resources)
    expect(hasExternal).toBe(false);
  });

  it('should return false for canvases without otherContent', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://example.org/manifest-no-annotations',
      '@type': 'sc:Manifest',
      label: 'Test Manifest without Annotations',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases: [
            {
              '@id': 'https://example.org/canvas1',
              '@type': 'sc:Canvas',
              label: 'Canvas 1',
              width: 1000,
              height: 1500,
              images: [
                {
                  '@type': 'oa:Annotation',
                  motivation: 'sc:painting',
                  resource: {
                    '@id': 'https://example.org/image1.jpg',
                    '@type': 'dctypes:Image',
                  },
                  on: 'https://example.org/canvas1',
                },
              ],
              // No otherContent at all
            },
          ],
        },
      ],
    };

    const manifest = manifesto.parseManifest(manifestJson);
    const sequences = manifest.getSequences();
    const canvas = sequences[0].getCanvases()[0];

    const hasExternal = hasExternalAnnotationRefs(canvas);
    expect(hasExternal).toBe(false);
  });
});
