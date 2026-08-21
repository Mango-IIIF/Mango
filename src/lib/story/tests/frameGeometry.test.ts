import { describe, expect, it } from 'vitest';
import {
  applyFrameField,
  clampFrameToBounds,
  lockRectAspect,
  nestedFrame,
} from '../frameGeometry';

const aspectOf = (box: { w: number; h: number }) => box.w / box.h;

describe('lockRectAspect', () => {
  const before = { x: 100, y: 100, w: 400, h: 300 };
  const aspect = 4 / 3;

  it('leaves a plain move alone', () => {
    const after = { x: 160, y: 90, w: 400, h: 300 };
    expect(lockRectAspect(before, after, aspect)).toEqual(after);
  });

  it('keeps the opposite corner when a corner is dragged and follows the diagonal', () => {
    // South-east handle dragged out, mostly sideways.
    const after = { x: 100, y: 100, w: 600, h: 330 };
    const locked = lockRectAspect(before, after, aspect);
    expect(locked.x).toBe(100);
    expect(locked.y).toBe(100);
    // Projection of (600, 330) onto the 4:3 diagonal.
    const height = (600 * aspect + 330) / (aspect * aspect + 1);
    expect(locked.h).toBeCloseTo(height, 6);
    expect(locked.w).toBeCloseTo(height * aspect, 6);
    expect(aspectOf(locked)).toBeCloseTo(aspect, 9);
    // Both axes counted: larger than before on each, smaller than the drag's
    // width and larger than its height.
    expect(locked.w).toBeGreaterThan(400);
    expect(locked.w).toBeLessThan(600);
    expect(locked.h).toBeGreaterThan(330);

    // Pulling the corner in mostly sideways still shrinks the frame.
    const shrunk = lockRectAspect(before, { x: 100, y: 100, w: 250, h: 280 }, aspect);
    expect(shrunk).toMatchObject({ x: 100, y: 100 });
    expect(shrunk.w).toBeLessThan(400);
    expect(shrunk.h).toBeLessThan(300);
    expect(aspectOf(shrunk)).toBeCloseTo(aspect, 9);

    // A drag exactly along the diagonal lands exactly on the pointer.
    const exact = lockRectAspect(before, { x: 100, y: 100, w: 800, h: 600 }, aspect);
    expect(exact.w).toBeCloseTo(800, 6);
    expect(exact.h).toBeCloseTo(600, 6);
  });

  it('anchors the untouched corner for the north-west handle', () => {
    // Dragging the top-left handle outwards: right and bottom edges stay.
    const after = { x: 40, y: 70, w: 460, h: 330 };
    const locked = lockRectAspect(before, after, aspect);
    expect(locked.x + locked.w).toBeCloseTo(500, 6);
    expect(locked.y + locked.h).toBeCloseTo(400, 6);
    expect(aspectOf(locked)).toBeCloseTo(aspect, 9);
  });

  it('keeps the edge opposite a dragged edge and re-centres the other axis', () => {
    // East handle: width grows, height follows, vertical centre stays.
    const wider = lockRectAspect(before, { x: 100, y: 100, w: 520, h: 300 }, aspect);
    expect(wider.x).toBe(100);
    expect(wider.w).toBeCloseTo(520, 6);
    expect(wider.h).toBeCloseTo(390, 6);
    expect(wider.y + wider.h / 2).toBeCloseTo(250, 6);

    // North handle: height shrinks, width follows, horizontal centre stays.
    const shorter = lockRectAspect(before, { x: 100, y: 160, w: 400, h: 240 }, aspect);
    expect(shorter.y + shorter.h).toBeCloseTo(400, 6);
    expect(shorter.h).toBeCloseTo(240, 6);
    expect(shorter.w).toBeCloseTo(320, 6);
    expect(shorter.x + shorter.w / 2).toBeCloseTo(300, 6);
  });

  it('shrinks towards the anchor rather than breaking the lock at the canvas edge', () => {
    const bounds = { width: 1000, height: 500 };
    // South-east drag far past the bottom of the canvas.
    const locked = lockRectAspect(before, { x: 100, y: 100, w: 900, h: 700 }, aspect, bounds);
    expect(locked.x).toBe(100);
    expect(locked.y).toBe(100);
    expect(locked.y + locked.h).toBeCloseTo(500, 6);
    expect(locked.x + locked.w).toBeLessThanOrEqual(1000);
    expect(aspectOf(locked)).toBeCloseTo(aspect, 9);

    // North-west drag past the top-left corner keeps the bottom-right anchor.
    const pulled = lockRectAspect(before, { x: -80, y: -60, w: 580, h: 460 }, aspect, bounds);
    expect(pulled.x + pulled.w).toBeCloseTo(500, 6);
    expect(pulled.y + pulled.h).toBeCloseTo(400, 6);
    expect(pulled.x).toBeGreaterThanOrEqual(0);
    expect(pulled.y).toBeGreaterThanOrEqual(0);
    expect(aspectOf(pulled)).toBeCloseTo(aspect, 9);

    // A move that hangs over an edge is shifted back in, size intact.
    const shifted = lockRectAspect(before, { x: 900, y: 100, w: 400, h: 300 }, aspect, bounds);
    expect(shifted).toEqual({ x: 600, y: 100, w: 400, h: 300 });
  });

  it('returns the box unchanged when the aspect or the box is degenerate', () => {
    expect(lockRectAspect(before, { x: 0, y: 0, w: 0, h: 10 }, aspect)).toEqual({
      x: 0,
      y: 0,
      w: 0,
      h: 10,
    });
    const after = { x: 5, y: 5, w: 50, h: 10 };
    expect(lockRectAspect(before, after, Number.NaN)).toEqual(after);
  });
});

describe('clampFrameToBounds', () => {
  it('shifts a box back inside the canvas and clamps one larger than it', () => {
    const bounds = { width: 1000, height: 800 };
    expect(clampFrameToBounds({ x: -50, y: 700, w: 400, h: 300 }, bounds)).toEqual({
      x: 0,
      y: 500,
      w: 400,
      h: 300,
    });
    expect(clampFrameToBounds({ x: 10, y: 10, w: 2000, h: 300 }, bounds)).toEqual({
      x: 0,
      y: 10,
      w: 1000,
      h: 300,
    });
  });
});

describe('applyFrameField', () => {
  const box = { x: 100, y: 200, w: 400, h: 300 };

  it('moves on x and y and keeps the size', () => {
    expect(applyFrameField(box, 'x', 50, 4 / 3)).toEqual({ ...box, x: 50 });
    expect(applyFrameField(box, 'y', 0, 4 / 3)).toEqual({ ...box, y: 0 });
  });

  it('lets the other dimension follow a typed width or height from the same corner', () => {
    expect(applyFrameField(box, 'w', 800, 4 / 3)).toEqual({ x: 100, y: 200, w: 800, h: 600 });
    expect(applyFrameField(box, 'h', 150, 4 / 3)).toEqual({ x: 100, y: 200, w: 200, h: 150 });
  });

  it('ignores values that cannot describe a frame', () => {
    expect(applyFrameField(box, 'w', 0, 4 / 3)).toEqual(box);
    expect(applyFrameField(box, 'h', Number.NaN, 4 / 3)).toEqual(box);
  });
});

describe('nestedFrame', () => {
  it('shrinks about the centre', () => {
    const nested = nestedFrame({ x: 0, y: 0, w: 1000, h: 500 });
    expect(nested).toEqual({ x: 100, y: 50, w: 800, h: 400 });
    expect(aspectOf(nested)).toBeCloseTo(2, 9);
  });
});
