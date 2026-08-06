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

/**
 * Moves the viewer to a chapter's framing, animating only when that framing is
 * expressed in the coordinate space the viewer is already showing.
 *
 * A viewBox is in canvas pixels, so tweening one across a source change
 * interpolates numbers that describe two different images — the camera sweeps
 * through positions meaningful on neither. Callers pass `sourceChanged` for any
 * transition that swapped the Manifest or the Canvas underneath, and the target
 * is applied in one step instead.
 */
export const panToViewBox = (
  viewer: ViewerApi,
  targetViewBox: ViewBox,
  sourceChanged: boolean,
  deps: PanDeps,
): (() => void) | null => {
  if (sourceChanged) {
    viewer.setViewBox?.(targetViewBox);
    return null;
  }

  return animateViewBoxTransition(viewer, targetViewBox, 500, {
    now: deps.now,
    requestAnimationFrame: deps.requestAnimationFrame,
    cancelAnimationFrame: deps.cancelAnimationFrame,
  });
};
