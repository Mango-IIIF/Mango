import { describe, expect, it } from 'vitest';
import { resolvedToW3C, w3cToResolved } from '../W3CParser';

describe('W3CParser', () => {
  it('converts rect annotations both ways', () => {
    const input = {
      id: 'a1',
      rect: { x: 10, y: 20, w: 30, h: 40 },
      text: 'note',
    };
    const w3c = resolvedToW3C(input as any, 'canvas-1');
    expect(w3c?.target.selector.type).toBe('FragmentSelector');

    const roundTrip = w3cToResolved(w3c as any);
    expect(roundTrip?.rect).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    expect(roundTrip?.text).toBe('note');
  });

  it('serializes notes and tags as valid textual bodies', () => {
    const input = {
      id: 'a-notes-tags',
      rect: { x: 1, y: 2, w: 3, h: 4 },
      text: 'main text',
      notes: 'private notes',
      tags: ['tag-a', 'tag-b'],
    };

    const w3c = resolvedToW3C(input as any, 'canvas-nt');
    expect(w3c?.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'main text', purpose: 'commenting' }),
        expect.objectContaining({ value: 'private notes', purpose: 'describing' }),
        expect.objectContaining({ value: 'tag-a', purpose: 'tagging' }),
        expect.objectContaining({ value: 'tag-b', purpose: 'tagging' }),
      ]),
    );

    const roundTrip = w3cToResolved(w3c as any);
    expect(roundTrip?.text).toBe('main text');
    expect(roundTrip?.notes).toBe('private notes');
    expect(roundTrip?.tags).toEqual(['tag-a', 'tag-b']);
  });

  it('converts polygon annotations both ways', () => {
    const input = {
      id: 'a2',
      polygon: {
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 10 },
          { x: 10, y: 30 },
        ],
      },
      text: 'shape',
    };
    const w3c = resolvedToW3C(input as any, 'canvas-2');
    expect(w3c?.target.selector.type).toBe('SvgSelector');

    const roundTrip = w3cToResolved(w3c as any);
    expect(roundTrip?.polygon?.points.length).toBe(3);
  });

  it('restores 1x1 fragments as points', () => {
    const input = {
      id: 'a3',
      type: 'Annotation',
      motivation: 'commenting',
      body: [{ type: 'TextualBody', value: 'point', format: 'text/plain' }],
      target: {
        type: 'SpecificResource',
        source: 'canvas-3',
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: 'xywh=pixel:100,200,1,1',
        },
      },
    };
    const resolved = w3cToResolved(input as any);
    expect(resolved?.point).toEqual({ x: 100, y: 200 });
    expect(resolved?.rect).toBeUndefined();
  });
});
