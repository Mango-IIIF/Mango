import { describe, expect, it } from 'vitest';
import { resolveAnnotationViewBox } from '../focus';

describe('annotation focus bounds', () => {
  it('focuses a point with a useful box derived from the current view', () => {
    const box = resolveAnnotationViewBox(
      { id: 'point-1', shapeType: 'point', point: { x: 500, y: 700 } },
      { x: 0, y: 0, w: 1_000, h: 800 },
    );
    expect(box).toEqual({ x: 400, y: 600, w: 200, h: 200 });
  });

  it('never returns the legacy one-pixel focus when no view is available', () => {
    const box = resolveAnnotationViewBox(
      { id: 'point-1', shapeType: 'point', point: { x: 10, y: 20 } },
      null,
    );
    expect(box?.w).toBe(200);
    expect(box?.h).toBe(200);
  });
});
