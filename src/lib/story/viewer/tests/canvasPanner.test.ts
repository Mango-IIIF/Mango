import { describe, expect, it, vi } from 'vitest';
import type { ViewerApi } from '../../../core/types/viewer-api';
import { isViewBoxEqual, panToViewBox } from '../canvasPanner';

const createViewer = (currentViewBox: { x: number; y: number; w: number; h: number } | null) => {
  const setViewBox = vi.fn();
  const viewer = {
    getViewBox: () => currentViewBox,
    setViewBox,
  } as unknown as ViewerApi;
  return { viewer, setViewBox };
};

/**
 * A hand-driven clock and frame queue, so a tween can be stepped deterministically
 * rather than waited on.
 */
const createFrameRunner = () => {
  let time = 0;
  const queue: FrameRequestCallback[] = [];
  return {
    deps: {
      now: () => time,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        queue.push(callback);
        return queue.length;
      },
      cancelAnimationFrame: () => undefined,
    },
    advance: (ms: number) => {
      time += ms;
      const pending = queue.splice(0, queue.length);
      pending.forEach((callback) => callback(time));
    },
  };
};

describe('panToViewBox', () => {
  it('animates towards the target when the source is unchanged', () => {
    const { viewer, setViewBox } = createViewer({ x: 0, y: 0, w: 100, h: 100 });
    const runner = createFrameRunner();

    const cancel = panToViewBox(viewer, { x: 100, y: 100, w: 100, h: 100 }, false, runner.deps);

    expect(cancel).toBeTypeOf('function');
    runner.advance(250);
    const { calls } = setViewBox.mock;
    const [midpoint] = calls[calls.length - 1];
    // Halfway through an eased 500ms tween the camera is between the two boxes.
    expect(midpoint.x).toBeGreaterThan(0);
    expect(midpoint.x).toBeLessThan(100);

    runner.advance(250);
    expect(setViewBox).toHaveBeenLastCalledWith({ x: 100, y: 100, w: 100, h: 100 });
  });

  it('applies the target in one step when the source changed', () => {
    const { viewer, setViewBox } = createViewer({ x: 0, y: 0, w: 100, h: 100 });
    const runner = createFrameRunner();

    const cancel = panToViewBox(viewer, { x: 100, y: 100, w: 100, h: 100 }, true, runner.deps);

    expect(cancel).toBeNull();
    expect(setViewBox).toHaveBeenCalledTimes(1);
    expect(setViewBox).toHaveBeenCalledWith({ x: 100, y: 100, w: 100, h: 100 });
  });

  it('applies the target in one step when the viewer has no framing to leave', () => {
    const { viewer, setViewBox } = createViewer(null);
    const runner = createFrameRunner();

    panToViewBox(viewer, { x: 10, y: 10, w: 50, h: 50 }, false, runner.deps);

    expect(setViewBox).toHaveBeenCalledTimes(1);
    expect(setViewBox).toHaveBeenCalledWith({ x: 10, y: 10, w: 50, h: 50 });
  });
});

describe('isViewBoxEqual', () => {
  it('treats sub-tolerance drift as equal and a real move as different', () => {
    const box = { x: 10, y: 20, w: 30, h: 40 };
    expect(isViewBoxEqual({ ...box, x: 10.001 }, box)).toBe(true);
    expect(isViewBoxEqual({ ...box, x: 11 }, box)).toBe(false);
    expect(isViewBoxEqual(null, box)).toBe(false);
  });
});
