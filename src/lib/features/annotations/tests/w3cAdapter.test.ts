import { describe, expect, it } from 'vitest';
import { W3CParser, type NormalizedShape } from '@mango-iiif/w3c-parser';
import { normalizedShapeTool, resolvedToW3C, w3cShapeTool, w3cToResolved } from '../w3c';

describe('W3C package adapter', () => {
  it('preserves Mango notes and tags around package serialization', () => {
    const serialized = resolvedToW3C(
      {
        id: 'annotation-1',
        rect: { x: 10, y: 20, w: 30, h: 40 },
        text: 'Main text',
        notes: 'Private notes',
        tags: ['one', 'two'],
      },
      'canvas-1',
    );

    const resolved = w3cToResolved(serialized);
    expect(resolved).toEqual(
      expect.objectContaining({
        id: 'annotation-1',
        rect: { x: 10, y: 20, w: 30, h: 40 },
        text: 'Main text',
        notes: 'Private notes',
        tags: ['one', 'two'],
      }),
    );
  });

  it('retains the created editor tool for every supported drawing geometry', () => {
    const examples: Array<{
      expected: 'rectangle' | 'point' | 'polygon' | 'freehand' | 'line';
      shape: NormalizedShape;
    }> = [
      { expected: 'rectangle', shape: { type: 'rect', geometry: { x: 1, y: 2, w: 3, h: 4 } } },
      { expected: 'point', shape: { type: 'point', geometry: { x: 1, y: 2 } } },
      {
        expected: 'polygon',
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
        expected: 'freehand',
        shape: {
          type: 'freehand',
          geometry: {
            points: [
              { x: 1, y: 2 },
              { x: 4, y: 5 },
            ],
          },
        },
      },
      {
        expected: 'line',
        shape: { type: 'line', geometry: { start: { x: 1, y: 2 }, end: { x: 4, y: 5 } } },
      },
    ];

    for (const { expected, shape } of examples) {
      const annotation = W3CParser.serialize({
        id: `annotation-${expected}`,
        canvasId: 'canvas-1',
        text: '',
        shape,
      });
      expect(normalizedShapeTool(shape)).toBe(expected);
      if (expected !== 'freehand') expect(w3cShapeTool(annotation)).toBe(expected);
    }
  });
});
