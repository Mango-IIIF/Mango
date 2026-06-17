import { describe, it, expect } from 'vitest';
import * as manifesto from 'manifesto.js';
import { collectAnnotationPageRefs } from '../externalAnnotations';

describe('collectAnnotationPageRefs', () => {
  it('should collect external annotation URLs from manifesto canvas object', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://example.org/manifest',
      '@type': 'sc:Manifest',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases: [
            {
              '@id': 'https://example.org/canvas1',
              '@type': 'sc:Canvas',
              width: 1000,
              height: 1500,
              otherContent: [
                {
                  '@id': 'https://example.org/annotations/list1',
                  '@type': 'sc:AnnotationList',
                  // No inline resources - this is an external reference
                },
              ],
            },
          ],
        },
      ],
    };

    const manifestoObject = manifesto.parseManifest(manifestJson);
    const sequences = manifestoObject.getSequences();
    const canvas = sequences[0].getCanvases()[0];

    const refs = collectAnnotationPageRefs(canvas);

    expect(refs).toEqual(['https://example.org/annotations/list1']);
  });

  it('should collect multiple external annotation URLs', () => {
    const manifestJson = {
      '@context': 'http://iiif.io/api/presentation/2/context.json',
      '@id': 'https://example.org/manifest',
      '@type': 'sc:Manifest',
      sequences: [
        {
          '@type': 'sc:Sequence',
          canvases: [
            {
              '@id': 'https://example.org/canvas1',
              '@type': 'sc:Canvas',
              width: 1000,
              height: 1500,
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

    const manifestoObject = manifesto.parseManifest(manifestJson);
    const sequences = manifestoObject.getSequences();
    const canvas = sequences[0].getCanvases()[0];

    const refs = collectAnnotationPageRefs(canvas);

    expect(refs).toContain('https://example.org/annotations/list1');
    expect(refs).toContain('https://example.org/annotations/list2');
    expect(refs).toHaveLength(2);
  });

  it('should still work with raw JSON canvas (backward compatibility)', () => {
    const canvasJson = {
      '@id': 'https://example.org/canvas1',
      '@type': 'sc:Canvas',
      width: 1000,
      height: 1500,
      otherContent: [
        {
          '@id': 'https://example.org/annotations/list1',
          '@type': 'sc:AnnotationList',
        },
      ],
    };

    const refs = collectAnnotationPageRefs(canvasJson);

    expect(refs).toEqual(['https://example.org/annotations/list1']);
  });
});
