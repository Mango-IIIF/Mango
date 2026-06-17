import type { ViewerApi } from '../../core/types/viewer-api';
import type { ViewBox } from '../../core/types/viewer';
import { animateViewBoxTransition } from '../viewBoxAnimation';

export const VIEWBOX_EQUALITY_TOLERANCE = 0.01;

export const isViewBoxEqual = (
  a: ViewBox | null | undefined,
  b: ViewBox,
  tolerance = VIEWBOX_EQUALITY_TOLERANCE,
): boolean => {
  if (!a) return false;
  return (
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.w - b.w) < tolerance &&
    Math.abs(a.h - b.h) < tolerance
  );
};

type PanDeps = {
  now: () => number;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
};

export const panToViewBox = (
  viewer: ViewerApi,
  targetViewBox: ViewBox,
  manifestChanged: boolean,
  deps: PanDeps,
): (() => void) | null => {
  if (manifestChanged) {
    viewer.setViewBox?.(targetViewBox);
    return null;
  }

  return animateViewBoxTransition(viewer, targetViewBox, 500, {
    now: deps.now,
    requestAnimationFrame: deps.requestAnimationFrame,
    cancelAnimationFrame: deps.cancelAnimationFrame,
  });
};
