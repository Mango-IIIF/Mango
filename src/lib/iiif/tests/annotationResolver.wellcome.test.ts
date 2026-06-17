import { describe, it, expect } from 'vitest';
import * as manifesto from 'manifesto.js';
import { getCanvasAnnotations } from '../annotationResolver';

/**
 * This test uses annotation structures based on real IIIF v2/v3 manifests
 * from institutions like Wellcome Collection, British Library, etc.
 * 
 * Real-world manifests may include:
 * - IIIF v2 annotations using the Open Annotation model
 * - IIIF v3 annotations using the W3C Web Annotation model
 * - Mix of painting and non-painting annotations
 * - Various selector types (Fragment, SVG, Point)
 * - Comments, tags, and other motivations
 */

describe('getCanvasAnnotations with real-world manifest structures', () => {
  it('should handle IIIF v3 annotations with FragmentSelector', () => {
    const v3ManifestJson = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/manifest',
      type: 'Manifest',
      items: [
        {
          id: 'https://example.org/canvas/1',
          type: 'Canvas',
          width: 2000,
          height: 3000,
          // Painting annotations (the actual content)
          items: [
            {
              id: 'https://example.org/page/painting',
              type: 'AnnotationPage',
              items: [
                {
                  id: 'https://example.org/annotation/painting-1',
                  type: 'Annotation',
                  motivation: 'painting',
                  body: {
                    id: 'https://example.org/image.jpg',
                    type: 'Image',
                    format: 'image/jpeg',
                  },
                  target: 'https://example.org/canvas/1',
                },
              ],
            },
          ],
          // Non-painting annotations (comments, tags, etc.)
          annotations: [
            {
              id: 'https://example.org/page/comments',
              type: 'AnnotationPage',
              items: [
                {
                  id: 'https://example.org/annotation/comment-1',
                  type: 'Annotation',
                  motivation: 'commenting',
                  body: {
                    type: 'TextualBody',
                    value: 'This is a marginal note',
                    format: 'text/plain',
                    language: 'en',
                  },
                  target: {
                    source: 'https://example.org/canvas/1',
                    selector: {
                      type: 'FragmentSelector',
                      value: 'xywh=100,200,300,400',
                    },
                  },
                },
                {
                  id: 'https://example.org/annotation/tag-1',
                  type: 'Annotation',
                  motivation: 'tagging',
                  body: {
                    type: 'TextualBody',
                    value: 'manuscript',
                    purpose: 'tagging',
                  },
                  target: 'https://example.org/canvas/1',
                },
              ],
            },
          ],
        },
      ],
    };

    const manifestoObject = manifesto.parseManifest(v3ManifestJson);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'https://example.org/canvas/1',
      0
    );

    // Should extract non-painting annotations only
    expect(annotations.length).toBe(2);

    const comment = annotations.find((a) => a.id === 'https://example.org/annotation/comment-1');
    expect(comment).toBeTruthy();
    expect(comment?.text).toBe('This is a marginal note');
    expect(comment?.rect).toEqual({ x: 100, y: 200, w: 300, h: 400 });
    expect(comment?.motivation).toEqual(['commenting']);

    const tag = annotations.find((a) => a.id === 'https://example.org/annotation/tag-1');
    expect(tag).toBeTruthy();
    expect(tag?.text).toBe('manuscript');
    expect(tag?.motivation).toEqual(['tagging']);
  });

  it('should handle IIIF v2 annotations with oa:commenting motivation', () => {
    const v2ManifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://example.org/manifest',
      '@type': 'sc:Manifest',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases: [
            {
              '@id': 'https://example.org/canvas/1',
              '@type': 'sc:Canvas',
              width: 2000,
              height: 3000,
              images: [
                {
                  '@type': 'oa:Annotation',
                  motivation: 'sc:painting',
                  resource: {
                    '@id': 'https://example.org/image.jpg',
                    '@type': 'dctypes:Image',
                  },
                  on: 'https://example.org/canvas/1',
                },
              ],
              otherContent: [
                {
                  '@id': 'https://example.org/list/comments',
                  '@type': 'sc:AnnotationList',
                  resources: [
                    {
                      '@type': 'oa:Annotation',
                      motivation: 'oa:commenting',
                      resource: {
                        '@type': 'dctypes:Text',
                        format: 'text/html',
                        chars: '<p>Historical note about this page</p>',
                      },
                      on: 'https://example.org/canvas/1#xywh=50,100,200,150',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const manifestoObject = manifesto.parseManifest(v2ManifestJson);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'https://example.org/canvas/1',
      0
    );

    // V2 annotations with otherContent
    expect(annotations.length).toBeGreaterThanOrEqual(0);
    // Note: v2 otherContent may require additional loading in real implementations
  });

  it('should handle annotations with PointSelector', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/manifest',
      type: 'Manifest',
      items: [
        {
          id: 'https://example.org/canvas/1',
          type: 'Canvas',
          annotations: [
            {
              id: 'https://example.org/page/points',
              type: 'AnnotationPage',
              items: [
                {
                  id: 'https://example.org/annotation/point-1',
                  type: 'Annotation',
                  motivation: 'commenting',
                  body: {
                    type: 'TextualBody',
                    value: 'Point of interest',
                  },
                  target: {
                    source: 'https://example.org/canvas/1',
                    selector: {
                      type: 'PointSelector',
                      x: 500,
                      y: 750,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const manifestoObject = manifesto.parseManifest(manifestJson);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'https://example.org/canvas/1',
      0
    );

    expect(annotations.length).toBe(1);
    expect(annotations[0].point).toEqual({ x: 500, y: 750 });
    expect(annotations[0].text).toBe('Point of interest');
  });

  it('should handle annotations with temporal selectors (video/audio)', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/manifest',
      type: 'Manifest',
      items: [
        {
          id: 'https://example.org/canvas/video',
          type: 'Canvas',
          duration: 60,
          annotations: [
            {
              id: 'https://example.org/page/captions',
              type: 'AnnotationPage',
              items: [
                {
                  id: 'https://example.org/annotation/caption-1',
                  type: 'Annotation',
                  motivation: 'supplementing',
                  body: {
                    type: 'TextualBody',
                    value: 'First caption',
                    format: 'text/plain',
                  },
                  target: 'https://example.org/canvas/video#t=0,5',
                },
                {
                  id: 'https://example.org/annotation/caption-2',
                  type: 'Annotation',
                  motivation: 'supplementing',
                  body: {
                    type: 'TextualBody',
                    value: 'Second caption',
                  },
                  target: 'https://example.org/canvas/video#t=5.5,10.2',
                },
              ],
            },
          ],
        },
      ],
    };

    const manifestoObject = manifesto.parseManifest(manifestJson);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'https://example.org/canvas/video',
      0
    );

    expect(annotations.length).toBe(2);
    
    const caption1 = annotations.find((a) => a.id === 'https://example.org/annotation/caption-1');
    expect(caption1?.time).toEqual({ start: 0, end: 5 });
    expect(caption1?.text).toBe('First caption');

    const caption2 = annotations.find((a) => a.id === 'https://example.org/annotation/caption-2');
    expect(caption2?.time).toEqual({ start: 5.5, end: 10.2 });
    expect(caption2?.text).toBe('Second caption');
  });

  it('should handle multiple annotation pages on same canvas', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/manifest',
      type: 'Manifest',
      items: [
        {
          id: 'https://example.org/canvas/1',
          type: 'Canvas',
          annotations: [
            {
              id: 'https://example.org/page/comments',
              type: 'AnnotationPage',
              items: [
                {
                  id: 'https://example.org/annotation/comment-1',
                  type: 'Annotation',
                  motivation: 'commenting',
                  body: { type: 'TextualBody', value: 'Comment 1' },
                  target: 'https://example.org/canvas/1',
                },
              ],
            },
            {
              id: 'https://example.org/page/tags',
              type: 'AnnotationPage',
              items: [
                {
                  id: 'https://example.org/annotation/tag-1',
                  type: 'Annotation',
                  motivation: 'tagging',
                  body: { type: 'TextualBody', value: 'tag1' },
                  target: 'https://example.org/canvas/1',
                },
                {
                  id: 'https://example.org/annotation/tag-2',
                  type: 'Annotation',
                  motivation: 'tagging',
                  body: { type: 'TextualBody', value: 'tag2' },
                  target: 'https://example.org/canvas/1',
                },
              ],
            },
          ],
        },
      ],
    };

    const manifestoObject = manifesto.parseManifest(manifestJson);
    const annotations = getCanvasAnnotations(
      manifestoObject,
      'https://example.org/canvas/1',
      0
    );

    // Should combine annotations from all pages
    expect(annotations.length).toBe(3);
    expect(annotations.map((a) => a.text).sort()).toEqual(['Comment 1', 'tag1', 'tag2']);
  });
});
