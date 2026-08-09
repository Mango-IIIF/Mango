/**
 * Conformance fixtures.
 *
 * Each case is a document shape Mango claims to handle, written the way the
 * IIIF Cookbook and the common annotation clients write it. The claim in the
 * support matrix is only as good as the assertion here, so a capability with no
 * fixture is a capability the matrix must not advertise.
 *
 * The round-trip assertion is deliberately semantic rather than textual: two
 * documents that mean the same thing may be spelled differently, and requiring
 * byte equality would fail on cardinality and key order without anything having
 * been lost.
 */

import { describe, expect, it } from 'vitest';
import {
  parseWebAnnotation,
  projectAnnotation,
  serializeWebAnnotation,
} from '@mango-iiif/w3c-parser';
import { applyPatch, createMangoAnnotation, resolveAnnotationJson } from '../canonical';
import { exportAnnotationPage } from '../export';
import { projectToResolved } from '../canonical';
import { parseAnnotationCss } from '../style';

const CANVAS = 'https://iiif.io/api/cookbook/recipe/0001/canvas/p1';

const context = 'http://iiif.io/api/presentation/3/context.json';

/** Reads a document back through the parser after Mango has handled it. */
const reparse = (json: unknown) => projectAnnotation(parseWebAnnotation(json).document);

describe('IIIF annotation conformance', () => {
  it('reads a Cookbook comment on a region', () => {
    const { annotation } = resolveAnnotationJson(
      {
        '@context': context,
        id: 'https://example.org/anno/region',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'Gänseliesel-Brunnen', language: 'de', format: 'text/plain' },
        target: `${CANVAS}#xywh=265,661,1260,1239`,
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.rect).toEqual({ x: 265, y: 661, w: 1260, h: 1239 });
    expect(annotation?.text).toBe('Gänseliesel-Brunnen');
    expect(annotation?.motivation).toEqual(['commenting']);
  });

  it('reads a point selector', () => {
    const { annotation } = resolveAnnotationJson(
      {
        '@context': context,
        id: 'https://example.org/anno/point',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'Here' },
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          selector: { type: 'PointSelector', x: 100, y: 200 },
        },
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.shapeType).toBe('point');
    expect(annotation?.point).toEqual({ x: 100, y: 200 });
  });

  it('reads a legacy 1×1 region as a point without rewriting the source', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/legacy-point',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'Legacy' },
        target: `${CANVAS}#xywh=50,60,1,1`,
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.shapeType).toBe('point');
    expect(annotation?.point).toEqual({ x: 50, y: 60 });

    // Re-export keeps the fragment the author wrote. Upgrading someone else's
    // selector on the way past would be an unrequested edit to their document;
    // moving a stored corpus to PointSelector is a migration, run deliberately.
    const item = (exportAnnotationPage([annotation!]).page.items as Array<
      Record<string, unknown>
    >)[0];
    expect((item.target as { selector: { type: string } }).selector.type).toBe(
      'FragmentSelector',
    );
  });

  it('writes a newly authored point as a PointSelector', () => {
    const annotation = projectToResolved(
      createMangoAnnotation({
        id: 'https://example.org/anno/new-point',
        canvasId: CANVAS,
        shape: { type: 'point', geometry: { x: 50, y: 60 } },
        text: 'New',
      }),
    )!;

    const item = (exportAnnotationPage([annotation]).page.items as Array<
      Record<string, unknown>
    >)[0];
    // Not a 1×1 region: that says "this one pixel", and a literal consumer
    // draws it as a rectangle.
    expect((item.target as { selector: { type: string } }).selector.type).toBe('PointSelector');
  });

  it('reads an SVG polygon', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/polygon',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'Shape' },
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          selector: {
            type: 'SvgSelector',
            value: '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="10,10 90,10 50,90"/></svg>',
          },
        },
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.shapeType).toBe('polygon');
    expect(annotation?.polygon?.points).toHaveLength(3);
  });

  it('keeps an open path open', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/polyline',
        type: 'Annotation',
        motivation: 'highlighting',
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          selector: {
            type: 'SvgSelector',
            value: '<svg xmlns="http://www.w3.org/2000/svg"><polyline points="10,10 40,80 90,20"/></svg>',
          },
        },
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.shapeType).toBe('freehand');
  });

  it('reads a tagging annotation', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/tag',
        type: 'Annotation',
        motivation: 'tagging',
        body: { type: 'TextualBody', value: 'bookplate', purpose: 'tagging' },
        target: `${CANVAS}#xywh=1,2,3,4`,
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.tags).toEqual(['bookplate']);
  });

  it('reads an HTML body as text without executing it', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/html',
        type: 'Annotation',
        motivation: 'commenting',
        body: {
          type: 'TextualBody',
          value: '<p>Bold <b>note</b><script>alert(1)</script></p>',
          format: 'text/html',
        },
        target: CANVAS,
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.text).toContain('note');
    expect(annotation?.text).not.toContain('<script>');
    expect(annotation?.bodies?.[0].type).toBe('html');
  });

  it('reads multilingual bodies and keeps every language', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/multilingual',
        type: 'Annotation',
        motivation: 'commenting',
        body: [
          { type: 'TextualBody', value: 'Gänseliesel', language: 'de' },
          { type: 'TextualBody', value: 'Goose girl', language: 'en' },
        ],
        target: CANVAS,
      },
      { canvasId: CANVAS, policy: { preferredLanguages: ['en'] } },
    );

    expect(annotation?.text).toBe('Goose girl');
    expect(annotation?.bodies?.map((body) => body.language)).toEqual(['de', 'en']);
  });

  it('reads a temporal selector on an AV canvas', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/temporal',
        type: 'Annotation',
        motivation: 'supplementing',
        body: { type: 'TextualBody', value: 'Cue' },
        target: `${CANVAS}#t=15.0,20.0`,
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.time).toEqual({ start: 15, end: 20 });
  });

  it('reads Annotorious-style path geometry', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/path',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'Traced' },
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          selector: {
            type: 'SvgSelector',
            value: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M100,100 l50,0 l0,50 z"/></svg>',
          },
        },
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.shapeType).toBe('polygon');
    expect(annotation?.polygon?.points.length).toBeGreaterThanOrEqual(3);
  });

  it('round-trips a document with a Choice body and a refined selector', () => {
    const source = {
      '@context': context,
      id: 'https://example.org/anno/choice',
      type: 'Annotation',
      motivation: 'commenting',
      body: {
        type: 'Choice',
        items: [
          { type: 'TextualBody', value: 'English', language: 'en' },
          { type: 'TextualBody', value: 'Deutsch', language: 'de' },
        ],
      },
      target: {
        type: 'SpecificResource',
        source: CANVAS,
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: 'xywh=1,2,3,4',
          refinedBy: { type: 'TextQuoteSelector', exact: 'Gänseliesel' },
        },
      },
    };

    const { annotation } = resolveAnnotationJson(source, { canvasId: CANVAS });
    const { json } = serializeWebAnnotation(annotation!.document!, { profile: 'preserved' });

    const before = reparse(source);
    const after = reparse(json);
    expect(after.bodies.map((body) => body.text)).toEqual(before.bodies.map((body) => body.text));
    expect(after.targets[0].shape).toEqual(before.targets[0].shape);
    expect(JSON.stringify(json)).toContain('TextQuoteSelector');
  });

  it('keeps unsupported valid data through an edit to a supported field', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/preserve',
        type: 'Annotation',
        motivation: 'commenting',
        'acme:collection': 'Special Collections',
        creator: { id: 'https://example.org/people/1', type: 'Person', name: 'A Curator' },
        body: { type: 'TextualBody', value: 'Before' },
        target: `${CANVAS}#xywh=1,2,3,4`,
      },
      { canvasId: CANVAS },
    );

    const { document } = applyPatch(annotation!.document!, { text: 'After' });
    const { json } = serializeWebAnnotation(document, { profile: 'preserved' });

    expect(JSON.stringify(json)).toContain('Special Collections');
    expect(JSON.stringify(json)).toContain('A Curator');
    expect(projectAnnotation(document).text).toBe('After');
  });

  it('reads an annotation styled through a stylesheet and a class', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/styled',
        type: 'Annotation',
        motivation: 'highlighting',
        stylesheet: { type: 'CssStylesheet', value: '.red { stroke: #ff0000; fill: none; }' },
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          styleClass: 'red',
          selector: { type: 'FragmentSelector', value: 'xywh=1,2,3,4' },
        },
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.styleHints?.strokeColor).toBe('#ff0000');
  });

  it('refuses active content in an annotation stylesheet', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/hostile',
        type: 'Annotation',
        motivation: 'highlighting',
        stylesheet: {
          type: 'CssStylesheet',
          value: '.x { stroke: red; background-image: url(https://tracker.example/p.gif); }',
        },
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          styleClass: 'x',
          selector: { type: 'FragmentSelector', value: 'xywh=1,2,3,4' },
        },
      },
      { canvasId: CANVAS },
    );

    // The colour is honoured; the fetch is not.
    expect(annotation?.styleHints?.strokeColor).toBe('red');
    expect(JSON.stringify(annotation?.styleHints)).not.toContain('tracker.example');
  });

  it.each([
    ['network URL', '.x { fill: url(https://tracker.example/pixel); }'],
    ['import', '@import "https://tracker.example/style.css"; .x { stroke: red; }'],
    ['global selector', 'body .x { stroke: red; }'],
    ['important override', '.x { stroke: red !important; }'],
    ['positioning property', '.x { position: fixed; top: 0; stroke: red; }'],
  ])('allowlists annotation CSS and rejects %s', (_name, css) => {
    const parsed = parseAnnotationCss(css);
    expect(parsed.rejected.length).toBeGreaterThan(0);
    expect(JSON.stringify(parsed.rules)).not.toContain('tracker.example');
    expect(JSON.stringify(parsed.rules)).not.toContain('!important');
    expect(JSON.stringify(parsed.rules)).not.toContain('position');
  });

  it('renders in the normal theme when a class has no stylesheet', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/unresolved-class',
        type: 'Annotation',
        motivation: 'highlighting',
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          styleClass: 'nonexistent',
          selector: { type: 'FragmentSelector', value: 'xywh=1,2,3,4' },
        },
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.styleHints).toBeUndefined();
    // The class does not select a layer or a colour on its own.
    expect(annotation?.targetStyleClass).toBe('nonexistent');
  });

  it('reads a bare array of annotations, as some servers return', () => {
    const page = [
      {
        id: 'https://example.org/anno/bare-1',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'One' },
        target: `${CANVAS}#xywh=1,2,3,4`,
      },
    ];

    const { annotation } = resolveAnnotationJson(page[0], { canvasId: CANVAS });
    expect(annotation?.text).toBe('One');
  });

  it('projects and re-exports without changing where the shape sits', () => {
    const original = {
      '@context': context,
      id: 'https://example.org/anno/stable',
      type: 'Annotation',
      motivation: 'commenting',
      body: { type: 'TextualBody', value: 'Stable' },
      target: `${CANVAS}#xywh=265,661,1260,1239`,
    };

    const { annotation } = resolveAnnotationJson(original, { canvasId: CANVAS });
    const exported = exportAnnotationPage([annotation!]);
    const reread = resolveAnnotationJson(
      (exported.page.items as unknown[])[0],
      { canvasId: CANVAS },
    );

    expect(reread.annotation?.rect).toEqual(annotation?.rect);
  });

  it('gives every projection a route back to the document it came from', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/traceable',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'Traceable' },
        target: `${CANVAS}#xywh=1,2,3,4`,
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.document).toBeTruthy();
    expect(annotation?.targetPath).toBeTruthy();
    const target = annotation!.document!.targets.find(
      (entry) => entry.path === annotation!.targetPath,
    );
    expect(target).toBeTruthy();
    expect(projectToResolved(annotation!.document!)?.rect).toEqual(annotation?.rect);
  });
});
