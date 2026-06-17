import { describe, it, expect } from 'vitest';
import * as manifesto from 'manifesto.js';
import { getCanvasAnnotations } from '../annotationResolver';

describe('IIIF v2 Annotation Resolution', () => {
  const v2ManifestWithAnnotations = {
    '@context': 'http://iiif.io/api/presentation/2/context.json',
    '@id': 'http://example.org/manifest-v2',
    '@type': 'sc:Manifest',
    'label': 'Test v2 Manifest',
    'sequences': [
      {
        '@type': 'sc:Sequence',
        'canvases': [
          {
            '@id': 'http://example.org/canvas/1',
            '@type': 'sc:Canvas',
            'label': 'Page 1',
            'width': 2000,
            'height': 3000,
            'images': [
              {
                '@type': 'oa:Annotation',
                'motivation': 'sc:painting',
                'resource': {
                  '@id': 'http://example.org/image.jpg',
                  '@type': 'dctypes:Image',
                },
                'on': 'http://example.org/canvas/1',
              },
            ],
            'otherContent': [
              {
                '@id': 'http://example.org/annotations/list1',
                '@type': 'sc:AnnotationList',
                'resources': [
                  {
                    '@id': 'http://example.org/anno/1',
                    '@type': 'oa:Annotation',
                    'motivation': 'oa:commenting',
                    'resource': {
                      '@type': 'cnt:ContentAsText',
                      'chars': 'Test comment annotation',
                      'format': 'text/plain',
                      'language': 'en',
                    },
                    'on': {
                      '@type': 'oa:SpecificResource',
                      'full': 'http://example.org/canvas/1',
                      'selector': {
                        '@type': 'oa:FragmentSelector',
                        'value': 'xywh=100,200,300,400',
                      },
                    },
                  },
                  {
                    '@id': 'http://example.org/anno/2',
                    '@type': 'oa:Annotation',
                    'motivation': 'sc:painting',
                    'resource': {
                      '@type': 'cnt:ContentAsText',
                      'chars': 'Should be filtered out',
                    },
                    'on': 'http://example.org/canvas/1',
                  },
                  {
                    '@id': 'http://example.org/anno/3',
                    '@type': 'oa:Annotation',
                    'motivation': 'oa:tagging',
                    'resource': {
                      '@type': 'oa:Tag',
                      'chars': 'manuscript',
                    },
                    'on': {
                      '@type': 'oa:SpecificResource',
                      'full': 'http://example.org/canvas/1',
                      'selector': {
                        '@type': 'oa:FragmentSelector',
                        'value': 'xywh=500,600,200,150',
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it('should detect v2 annotations in otherContent', () => {
    const manifestoObject = manifesto.parseManifest(v2ManifestWithAnnotations);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'http://example.org/canvas/1',
      0
    );

    // Should get 3 annotations (text painting annotations are now kept for transcriptions)
    expect(annotations.length).toBe(3);
  });

  it('should extract comment annotation with spatial selector', () => {
    const manifestoObject = manifesto.parseManifest(v2ManifestWithAnnotations);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'http://example.org/canvas/1',
      0
    );

    const commentAnno = annotations.find(a => a.id === 'http://example.org/anno/1');
    expect(commentAnno).toBeDefined();
    expect(commentAnno?.text).toBe('Test comment annotation');
    expect(commentAnno?.rect).toEqual({ x: 100, y: 200, w: 300, h: 400 });
    expect(commentAnno?.motivation).toContain('oa:commenting');
  });

  it('should extract tag annotation', () => {
    const manifestoObject = manifesto.parseManifest(v2ManifestWithAnnotations);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'http://example.org/canvas/1',
      0
    );

    const tagAnno = annotations.find(a => a.id === 'http://example.org/anno/3');
    expect(tagAnno).toBeDefined();
    expect(tagAnno?.text).toBe('manuscript');
    expect(tagAnno?.rect).toEqual({ x: 500, y: 600, w: 200, h: 150 });
    expect(tagAnno?.motivation).toContain('oa:tagging');
  });

  it('should keep text painting annotations (transcriptions)', () => {
    const manifestoObject = manifesto.parseManifest(v2ManifestWithAnnotations);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'http://example.org/canvas/1',
      0
    );

    // Text painting annotations should be kept (for OCR/transcriptions)
    const paintingAnno = annotations.find(a => a.id === 'http://example.org/anno/2');
    expect(paintingAnno).toBeDefined();
    expect(paintingAnno?.text).toBe('Should be filtered out');
    expect(paintingAnno?.motivation).toContain('sc:painting');
  });

  it('should handle canvas without annotations', () => {
    const manifestWithoutAnnos = {
      ...v2ManifestWithAnnotations,
      sequences: [
        {
          ...v2ManifestWithAnnotations.sequences[0],
          canvases: [
            {
              ...v2ManifestWithAnnotations.sequences[0].canvases[0],
              otherContent: undefined,
            },
          ],
        },
      ],
    };

    const manifestoObject = manifesto.parseManifest(manifestWithoutAnnos);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'http://example.org/canvas/1',
      0
    );

    expect(annotations.length).toBe(0);
  });
});
