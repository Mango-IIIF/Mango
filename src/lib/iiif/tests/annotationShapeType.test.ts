import { describe, expect, it } from 'vitest';
import * as manifesto from 'manifesto.js';
import { getCanvasAnnotations, isOpenPathAnnotation } from '../annotationResolver';

const CANVAS = 'https://example.org/canvas-1';

const manifestWith = (annotations: unknown[]) => ({
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://example.org/manifest.json',
  type: 'Manifest',
  items: [
    {
      id: CANVAS,
      type: 'Canvas',
      width: 1000,
      height: 1000,
      annotations: [{ id: 'page-1', type: 'AnnotationPage', items: annotations }],
    },
  ],
});

const svgAnnotation = (id: string, svg: string) => ({
  id,
  type: 'Annotation',
  motivation: 'commenting',
  body: { type: 'TextualBody', value: id },
  target: {
    type: 'SpecificResource',
    source: CANVAS,
    selector: { type: 'SvgSelector', value: svg },
  },
});

const resolve = (annotations: unknown[]) =>
  getCanvasAnnotations(manifesto.parseManifest(manifestWith(annotations)), CANVAS);

describe('annotation shape type', () => {
  it('keeps a freehand path open when it comes from an annotation page', () => {
    const resolved = resolve([
      svgAnnotation(
        'freehand-1',
        '<svg><polyline points="10,10 40,80 90,20 140,70"/></svg>',
      ),
    ]);

    const freehand = resolved.find((item) => item.id === 'freehand-1');
    expect(freehand, 'annotation was not resolved').toBeDefined();
    // The whole point: loading an annotation must record what shape it is, not
    // leave every renderer to infer it.
    expect(freehand!.shapeType).toBe('freehand');
    expect(isOpenPathAnnotation(freehand!)).toBe(true);
  });

  it('keeps a polygon closed', () => {
    const resolved = resolve([
      svgAnnotation('polygon-1', '<svg><polygon points="10,10 90,10 90,90 10,90"/></svg>'),
    ]);

    const polygon = resolved.find((item) => item.id === 'polygon-1');
    expect(polygon!.shapeType).toBe('polygon');
    expect(isOpenPathAnnotation(polygon!)).toBe(false);
  });

  it('reads a line as an open path', () => {
    const resolved = resolve([
      svgAnnotation('line-1', '<svg><line x1="10" y1="10" x2="90" y2="90"/></svg>'),
    ]);

    const line = resolved.find((item) => item.id === 'line-1');
    expect(line && isOpenPathAnnotation(line)).toBe(true);
  });
});

describe('isOpenPathAnnotation', () => {
  it('trusts the recorded shape over the selector it was built from', () => {
    // A freehand serialised without an SvgSelector still has to render open —
    // this is the case the old string sniff got wrong, because there was no
    // string to sniff.
    expect(isOpenPathAnnotation({ shapeType: 'freehand', polygon: { points: [] } })).toBe(true);
    expect(isOpenPathAnnotation({ shapeType: 'line', polygon: { points: [] } })).toBe(true);
    expect(isOpenPathAnnotation({ shapeType: 'polygon', polygon: { points: [] } })).toBe(false);
  });

  it('falls back to the selector when no shape was recorded', () => {
    expect(
      isOpenPathAnnotation({ polygon: { points: [], svg: '<polyline points="1,1 2,2"/>' } }),
    ).toBe(true);
    expect(
      isOpenPathAnnotation({ polygon: { points: [], svg: '<polygon points="1,1 2,2"/>' } }),
    ).toBe(false);
  });
});
