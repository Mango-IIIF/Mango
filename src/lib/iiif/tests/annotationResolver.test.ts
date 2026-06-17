import { describe, it, expect } from 'vitest';
import * as manifesto from 'manifesto.js';
import { getCanvasAnnotations } from '../annotationResolver';

const manifestJson = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  'id': 'https://example.org/manifest.json',
  'type': 'Manifest',
  items: [
    {
      id: 'canvas-1',
      type: 'Canvas',
      annotations: [
        {
          id: 'page-1',
          type: 'AnnotationPage',
          items: [
            {
              id: 'anno-rect',
              type: 'Annotation',
              body: {
                type: 'TextualBody',
                format: 'text/html',
                value: '<p>Region <b>note</b></p>',
              },
              target: {
                source: 'canvas-1',
                selector: {
                  type: 'FragmentSelector',
                  value: 'xywh=10,20,30,40',
                },
              },
            },
            {
              id: 'anno-time',
              type: 'Annotation',
              body: { type: 'TextualBody', value: 'Cue text' },
              target: 'canvas-1#t=1.5,3.5',
            },
            {
              id: 'anno-point',
              type: 'Annotation',
              body: { type: 'TextualBody', value: 'Point note' },
              target: {
                source: 'canvas-1',
                selector: {
                  type: 'PointSelector',
                  x: 100,
                  y: 200,
                },
              },
            },
            {
              id: 'anno-svg',
              type: 'Annotation',
              body: { type: 'TextualBody', value: 'Polygon note' },
              target: {
                source: 'canvas-1',
                selector: {
                  type: 'SvgSelector',
                  value: "<svg><polygon points='10,10 20,20 30,10' /></svg>",
                },
              },
            },
            {
              id: 'anno-full',
              type: 'Annotation',
              body: { type: 'TextualBody', value: 'Full canvas note' },
              motivation: 'commenting',
              target: 'canvas-1',
            },
            {
              id: 'anno-chars',
              type: 'Annotation',
              resource: {
                '@type': 'dctypes:Text',
                chars: 'Chars text body',
              },
              target: {
                source: 'canvas-1',
                selector: {
                  type: 'FragmentSelector',
                  value: 'xywh=5,5,10,10',
                },
              },
            },
          ],
        },
      ],
    },
  ],
};

const manifest = manifesto.parseManifest(manifestJson);

describe('getCanvasAnnotations', () => {
  it('parses spatial and temporal selectors', () => {
    const annotations = getCanvasAnnotations(manifest, 'canvas-1');
    const rect = annotations.find((annotation) => annotation.id === 'anno-rect');
    const time = annotations.find((annotation) => annotation.id === 'anno-time');
    const point = annotations.find((annotation) => annotation.id === 'anno-point');
    const polygon = annotations.find((annotation) => annotation.id === 'anno-svg');
    const full = annotations.find((annotation) => annotation.id === 'anno-full');
    const chars = annotations.find((annotation) => annotation.id === 'anno-chars');

    expect(rect?.rect).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    expect(rect?.text).toBe('Region note');
    expect(time?.time).toEqual({ start: 1.5, end: 3.5 });
    expect(point?.point).toEqual({ x: 100, y: 200 });
    expect(polygon?.polygon?.points.length).toBe(3);
    expect(full?.text).toBe('Full canvas note');
    expect(chars?.text).toBe('Chars text body');
  });
});
