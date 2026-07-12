import { describe, expect, it } from 'vitest';
import { resolvedToW3C, w3cToResolved } from '../w3c';

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
});
