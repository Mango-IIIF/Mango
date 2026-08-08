import { describe, expect, it } from 'vitest';
import {
  parseWebAnnotation,
  serializeWebAnnotation,
  type NeutralShape,
} from '@mango-iiif/w3c-parser';
import {
  applyPatch,
  createMangoAnnotation,
  projectToResolved,
  resolveAnnotationJson,
  shapeFromResolved,
  shapeTool,
} from '../canonical';
import { MANGO_NOTE_KEY } from '../profile';

const CANVAS = 'https://example.org/canvas/1';

const parse = (json: unknown) => parseWebAnnotation(json).document;

describe('canonical adapter', () => {
  it('keeps every construct it does not model when one field is edited', () => {
    // Four constructs Mango does not model, in one document: a Choice body, a
    // second body, a refined selector, and a vendor extension. All of them have
    // to survive an edit to the comment text. The adapter this replaced rebuilt
    // the document from a flattened value, so all four were gone after the
    // first save.
    const document = parse({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: 'https://example.org/anno/1',
      type: 'Annotation',
      motivation: 'commenting',
      'acme:reviewedBy': 'curator-7',
      body: [
        { type: 'TextualBody', value: 'Original comment', purpose: 'commenting' },
        { type: 'TextualBody', value: 'transcript', purpose: 'transcribing', language: 'la' },
        {
          type: 'Choice',
          items: [
            { type: 'TextualBody', value: 'English', language: 'en' },
            { type: 'TextualBody', value: 'Cymraeg', language: 'cy' },
          ],
        },
      ],
      target: {
        type: 'SpecificResource',
        source: CANVAS,
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: 'xywh=10,20,30,40',
          refinedBy: { type: 'TextQuoteSelector', exact: 'in principio' },
        },
      },
    });

    const { document: edited, changed } = applyPatch(document, { text: 'Edited comment' });
    expect(changed).toBe(true);

    const json = serializeWebAnnotation(edited, { profile: 'iiif-presentation-3' }).json;
    const bodies = json.body as Array<Record<string, unknown>>;
    expect(bodies[0].value).toBe('Edited comment');
    expect(bodies[1]).toMatchObject({ value: 'transcript', language: 'la' });
    expect(bodies[2]).toMatchObject({ type: 'Choice' });
    expect(json['acme:reviewedBy']).toBe('curator-7');
    const target = json.target as { selector: Record<string, unknown> };
    expect(target.selector.refinedBy).toMatchObject({ type: 'TextQuoteSelector' });
  });

  it('edits the display body rather than the first one', () => {
    // A tag sitting in front of the comment must not absorb the comment.
    const document = parse({
      id: 'https://example.org/anno/2',
      type: 'Annotation',
      motivation: 'commenting',
      body: [
        { type: 'TextualBody', value: 'marginalia', purpose: 'tagging' },
        { type: 'TextualBody', value: 'Old text', purpose: 'commenting' },
      ],
      target: CANVAS,
    });

    const { document: edited } = applyPatch(document, { text: 'New text' });
    const projected = projectToResolved(edited);
    expect(projected?.tags).toEqual(['marginalia']);
    expect(projected?.text).toBe('New text');
  });

  it('writes a layer as a styleClass and never as a motivation', () => {
    const document = createMangoAnnotation({
      canvasId: CANVAS,
      shape: { type: 'rect', geometry: { x: 1, y: 2, w: 3, h: 4 } },
      text: 'A note',
      styleClass: 'research',
    });

    expect(document.motivation).toEqual(['commenting']);
    const json = serializeWebAnnotation(document, { profile: 'iiif-presentation-3' }).json;
    expect(json.motivation).toBe('commenting');
    expect((json.target as { styleClass?: string }).styleClass).toBe('research');
  });

  it('keeps a private note out of the bodies', () => {
    const document = createMangoAnnotation({
      canvasId: CANVAS,
      shape: { type: 'point', geometry: { x: 5, y: 6 } },
      text: 'Public comment',
      note: 'Not for publication',
    });

    expect(document.bodies.map((body) => body.value)).toEqual(['Public comment']);
    expect(document.extensions[MANGO_NOTE_KEY]).toBe('Not for publication');
    expect(projectToResolved(document)?.notes).toBe('Not for publication');
  });

  it('round-trips every shape the editor can author', () => {
    const shapes: Array<{ tool: string; shape: NeutralShape }> = [
      { tool: 'rectangle', shape: { type: 'rect', geometry: { x: 1, y: 2, w: 3, h: 4 } } },
      { tool: 'point', shape: { type: 'point', geometry: { x: 1, y: 2 } } },
      {
        tool: 'polygon',
        shape: {
          type: 'polygon',
          geometry: {
            points: [
              { x: 1, y: 2 },
              { x: 4, y: 5 },
              { x: 7, y: 2 },
            ],
          },
        },
      },
      {
        tool: 'freehand',
        shape: {
          type: 'freehand',
          geometry: {
            points: [
              { x: 1, y: 2 },
              { x: 4, y: 5 },
              { x: 9, y: 1 },
            ],
          },
        },
      },
      {
        tool: 'line',
        shape: { type: 'line', geometry: { start: { x: 1, y: 2 }, end: { x: 4, y: 5 } } },
      },
    ];

    for (const { tool, shape } of shapes) {
      expect(shapeTool(shape)).toBe(tool);
      const document = createMangoAnnotation({ canvasId: CANVAS, shape });
      const json = serializeWebAnnotation(document, { profile: 'iiif-presentation-3' }).json;
      const { annotation } = resolveAnnotationJson(json, { canvasId: CANVAS });
      expect(annotation, `${tool} did not resolve`).toBeTruthy();
      expect(shapeTool(shapeFromResolved(annotation!)), `${tool} changed on round trip`).toBe(tool);
    }
  });

  it('reads SVG path geometry that other annotation clients emit', () => {
    // Annotorious and Recogito write `<path d="...">`. This used to project no
    // geometry at all, so their annotations loaded as invisible.
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/3',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'From Recogito' },
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          selector: {
            type: 'SvgSelector',
            value: '<svg><path d="M10 10 L90 10 L90 90 Z"/></svg>',
          },
        },
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.shapeType).toBe('polygon');
    expect(annotation?.polygon?.points.length).toBeGreaterThanOrEqual(3);
    expect(annotation?.editability).toBe('editable');
  });

  it('preserves an annotation whose geometry it cannot edit', () => {
    const { annotation } = resolveAnnotationJson(
      {
        id: 'https://example.org/anno/4',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'Two separate marks' },
        target: {
          type: 'SpecificResource',
          source: CANVAS,
          selector: {
            type: 'SvgSelector',
            value: '<svg><path d="M0 0 L10 0 L10 10 Z M50 50 L60 50 L60 60 Z"/></svg>',
          },
        },
      },
      { canvasId: CANVAS },
    );

    expect(annotation?.editability).toBe('render-only');
    // Still exportable, byte for byte, through its canonical document.
    const json = serializeWebAnnotation(annotation!.document!, { profile: 'preserved' }).json;
    expect(JSON.stringify(json)).toContain('M0 0 L10 0 L10 10 Z M50 50 L60 50 L60 60 Z');
  });

  it('refuses to put an application layer name in the motivation', () => {
    expect(() =>
      createMangoAnnotation({
        canvasId: CANVAS,
        shape: { type: 'rect', geometry: { x: 0, y: 0, w: 1, h: 1 } },
        motivation: 'mine',
      }),
    ).toThrow();
  });
});

describe('body language and direction', () => {
  it('sets language on the display body without touching the tag', () => {
    const document = createMangoAnnotation({
      canvasId: CANVAS,
      shape: { type: 'rect', geometry: { x: 0, y: 0, w: 1, h: 1 } },
      text: 'Ein Kommentar',
      tags: ['marginalia'],
    });

    const { document: edited } = applyPatch(document, {}, { language: 'de' });
    const bodies = edited.bodies;
    expect(bodies[0].language).toEqual(['de']);
    expect(bodies[1].language).toEqual([]);
    expect(bodies[1].value).toBe('marginalia');
  });

  it('sets and clears text direction', () => {
    const document = createMangoAnnotation({
      canvasId: CANVAS,
      shape: { type: 'rect', geometry: { x: 0, y: 0, w: 1, h: 1 } },
      text: 'نص',
    });

    const rtl = applyPatch(document, {}, { textDirection: 'rtl' }).document;
    expect(rtl.bodies[0].textDirection).toBe('rtl');

    const cleared = applyPatch(rtl, {}, { textDirection: '' }).document;
    expect(cleared.bodies[0].textDirection).toBeUndefined();
  });

  it('edits one translated body by canonical path without changing its sibling', () => {
    const document = createMangoAnnotation({
      canvasId: CANVAS,
      shape: { type: 'rect', geometry: { x: 0, y: 0, w: 1, h: 1 } },
      textBodies: [
        { value: 'English text', language: 'en', purpose: 'commenting' },
        { value: 'Testun Cymraeg', language: 'cy', purpose: 'commenting' },
      ],
    });
    const projection = projectToResolved(document)!;
    const welshPath = projection.bodies?.find((body) => body.language === 'cy')?.path;

    const edited = applyPatch(
      document,
      { text: 'Testun newydd' },
      { bodyPath: welshPath, bodyPurpose: 'transcribing' },
    ).document;

    expect(edited.bodies.map((body) => body.value)).toEqual([
      'English text',
      'Testun newydd',
    ]);
    expect(edited.bodies[0].purpose).toEqual(['commenting']);
    expect(edited.bodies[1].purpose).toEqual(['transcribing']);
  });

  it('adds a parallel translation instead of replacing the display body', () => {
    const document = createMangoAnnotation({
      canvasId: CANVAS,
      shape: { type: 'rect', geometry: { x: 0, y: 0, w: 1, h: 1 } },
      text: 'English text',
      language: 'en',
    });

    const edited = applyPatch(
      document,
      { text: 'Texte français' },
      { createBody: true, language: 'fr', bodyPurpose: 'commenting' },
    ).document;

    expect(edited.bodies.map((body) => [body.value, body.language[0]])).toEqual([
      ['English text', 'en'],
      ['Texte français', 'fr'],
    ]);
  });
});
