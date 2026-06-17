import { describe, it, expect, vi } from 'vitest';
import * as manifesto from 'manifesto.js';
import { createExternalAnnotationLoader, collectAnnotationPageRefs } from '../externalAnnotations';

describe('External Annotation Integration (Wellcome Collection style)', () => {
  it('should load and parse external annotations from v2 manifest with otherContent URLs', async () => {
    // Manifest structure matching Wellcome Collection
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://wellcomecollection.org/works/test/manifest',
      '@type': 'sc:Manifest',
      label: 'Test Manifest',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases: [
            {
              '@id': 'https://wellcomecollection.org/canvas/page1',
              '@type': 'sc:Canvas',
              label: '1',
              width: 2090,
              height: 3072,
              images: [
                {
                  '@type': 'oa:Annotation',
                  motivation: 'sc:painting',
                  resource: {
                    '@id': 'https://example.org/image1.jpg',
                    '@type': 'dctypes:Image',
                  },
                  on: 'https://wellcomecollection.org/canvas/page1',
                },
              ],
            },
            {
              '@id': 'https://wellcomecollection.org/canvas/page2',
              '@type': 'sc:Canvas',
              label: '2',
              width: 2090,
              height: 3072,
              images: [
                {
                  '@type': 'oa:Annotation',
                  motivation: 'sc:painting',
                  resource: {
                    '@id': 'https://example.org/image2.jpg',
                    '@type': 'dctypes:Image',
                  },
                  on: 'https://wellcomecollection.org/canvas/page2',
                },
              ],
              otherContent: [
                {
                  '@id': 'https://wellcomecollection.org/annotations/page2',
                  '@type': 'sc:AnnotationList',
                  // Note: No inline resources - this is an external reference
                },
              ],
            },
          ],
        },
      ],
    };

    // Annotation page JSON that would be fetched from the external URL
    const annotationPageJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://wellcomecollection.org/annotations/page2',
      '@type': 'sc:AnnotationList',
      resources: [
        {
          '@type': 'oa:Annotation',
          motivation: 'oa:commenting',
          resource: {
            '@type': 'dctypes:Text',
            format: 'text/plain',
            chars: 'This is a comment on page 2.',
          },
          on: {
            '@type': 'oa:SpecificResource',
            full: 'https://wellcomecollection.org/canvas/page2',
            selector: {
              '@type': 'oa:FragmentSelector',
              value: 'xywh=100,100,500,300',
            },
          },
        },
        {
          '@type': 'oa:Annotation',
          motivation: 'oa:tagging',
          resource: {
            '@type': 'oa:Tag',
            chars: 'botanical',
          },
          on: 'https://wellcomecollection.org/canvas/page2',
        },
      ],
    };

    // Mock fetch to return the annotation page
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => annotationPageJson,
    });

    // Parse manifest with manifesto.js
    const manifestoObject = manifesto.parseManifest(manifestJson);
    const canvases = manifestoObject.getSequences()[0].getCanvases();
    
    // Test canvas without annotations (page 1)
    const canvas1 = canvases[0];
    const refs1 = collectAnnotationPageRefs(canvas1);
    expect(refs1).toEqual([]);

    // Test canvas with external annotation URL (page 2)
    const canvas2 = canvases[1];
    const refs2 = collectAnnotationPageRefs(canvas2);
    expect(refs2).toEqual(['https://wellcomecollection.org/annotations/page2']);

    // Load external annotations
    const loader = createExternalAnnotationLoader(mockFetch);
    const annotations = await loader.load(
      canvas2,
      'page2-key',
      'https://wellcomecollection.org/canvas/page2'
    );

    // Verify fetch was called with the correct URL
    expect(mockFetch).toHaveBeenCalledWith('https://wellcomecollection.org/annotations/page2');

    // Verify annotations were parsed correctly
    expect(annotations).toHaveLength(2);
    
    // Check comment annotation
    const commentAnnotation = annotations.find(a => a.motivation?.some(m => m.includes('commenting')));
    expect(commentAnnotation).toBeDefined();
    expect(commentAnnotation?.text).toBe('This is a comment on page 2.');
    expect(commentAnnotation?.rect).toEqual({ x: 100, y: 100, w: 500, h: 300 });

    // Check tag annotation
    const tagAnnotation = annotations.find(a => a.motivation?.some(m => m.includes('tagging')));
    expect(tagAnnotation).toBeDefined();
    expect(tagAnnotation?.text).toBe('botanical');
  });

  it('should handle canvases with multiple external annotation lists', async () => {
    const manifestJson = {
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
              width: 1000,
              height: 1500,
              images: [],
              otherContent: [
                {
                  '@id': 'https://example.org/annotations/list1',
                  '@type': 'sc:AnnotationList',
                },
                {
                  '@id': 'https://example.org/annotations/list2',
                  '@type': 'sc:AnnotationList',
                },
              ],
            },
          ],
        },
      ],
    };

    const annotationList1 = {
      '@type': 'sc:AnnotationList',
      resources: [
        {
          '@type': 'oa:Annotation',
          motivation: 'oa:commenting',
          resource: { chars: 'Comment 1' },
          on: 'https://example.org/canvas/1',
        },
      ],
    };

    const annotationList2 = {
      '@type': 'sc:AnnotationList',
      resources: [
        {
          '@type': 'oa:Annotation',
          motivation: 'oa:commenting',
          resource: { chars: 'Comment 2' },
          on: 'https://example.org/canvas/1',
        },
      ],
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'https://example.org/annotations/list1') {
        return { ok: true, json: async () => annotationList1 };
      }
      if (url === 'https://example.org/annotations/list2') {
        return { ok: true, json: async () => annotationList2 };
      }
      throw new Error('Unexpected URL');
    });

    const manifestoObject = manifesto.parseManifest(manifestJson);
    const canvas = manifestoObject.getSequences()[0].getCanvases()[0];

    const refs = collectAnnotationPageRefs(canvas);
    expect(refs).toHaveLength(2);
    expect(refs).toContain('https://example.org/annotations/list1');
    expect(refs).toContain('https://example.org/annotations/list2');

    const loader = createExternalAnnotationLoader(mockFetch);
    const annotations = await loader.load(canvas, 'canvas-key', 'https://example.org/canvas/1');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(annotations).toHaveLength(2);
    expect(annotations[0].text).toBe('Comment 1');
    expect(annotations[1].text).toBe('Comment 2');
  });

  it('should cache external annotation results', async () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@type': 'sc:Manifest',
      sequences: [
        {
          canvases: [
            {
              '@id': 'https://example.org/canvas/1',
              width: 1000,
              height: 1500,
              images: [],
              otherContent: [
                {
                  '@id': 'https://example.org/annotations/list',
                  '@type': 'sc:AnnotationList',
                },
              ],
            },
          ],
        },
      ],
    };

    const annotationList = {
      '@type': 'sc:AnnotationList',
      resources: [
        {
          '@type': 'oa:Annotation',
          motivation: 'oa:commenting',
          resource: { chars: 'Cached comment' },
          on: 'https://example.org/canvas/1',
        },
      ],
    };

    let fetchCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      return { ok: true, json: async () => annotationList };
    });

    const manifestoObject = manifesto.parseManifest(manifestJson);
    const canvas = manifestoObject.getSequences()[0].getCanvases()[0];

    const loader = createExternalAnnotationLoader(mockFetch);
    
    // Load first time
    const annotations1 = await loader.load(canvas, 'key1', 'https://example.org/canvas/1');
    expect(annotations1).toHaveLength(1);
    expect(fetchCount).toBe(1);

    // Load second time with same canvas - should use cache
    const annotations2 = await loader.load(canvas, 'key2', 'https://example.org/canvas/1');
    expect(annotations2).toHaveLength(1);
    expect(fetchCount).toBe(1); // Should not fetch again
  });
});
