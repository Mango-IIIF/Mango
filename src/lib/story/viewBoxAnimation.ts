/**
 * Smooth ViewBox Animation Utility
 *
 * Provides animated transitions between viewBox states using requestAnimationFrame.
 * Used by both story viewer and story builder for consistent smooth transitions.
 */

import type { ViewBox } from '../core/types/viewer';
import type { ViewerApi } from '../core/types/viewer-api';

type AnimationDeps = {
  now?: () => number;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
};

/**
 * Smoothly animates viewBox transition from current state to target state
 * @param viewer - Viewer API instance
 * @param targetViewBox - Target viewBox to animate to
 * @param durationMs - Animation duration in milliseconds (default: 500ms)
 * @param deps - Runtime dependencies for testing
 */
export const animateViewBoxTransition = (
  viewer: ViewerApi,
  targetViewBox: ViewBox,
  durationMs = 500,
  deps: AnimationDeps = {},
): (() => void) => {
  const now = deps.now ?? (() => Date.now());
  const rAF =
    deps.requestAnimationFrame ??
    (typeof globalThis !== 'undefined' && globalThis.requestAnimationFrame
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : null);
  const cAF =
    deps.cancelAnimationFrame ??
    (typeof globalThis !== 'undefined' && globalThis.cancelAnimationFrame
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : null);

  const currentViewBox = viewer.getViewBox?.();
  if (!currentViewBox || !rAF) {
    // Fallback: immediate update if no animation support or no current viewBox
    viewer.setViewBox?.(targetViewBox);
    return () => {}; // No-op cancel function
  }

  const start = now();
  const from = currentViewBox;
  const to = targetViewBox;
  let rafHandle: number | null = null;
  let cancelled = false;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const easeInOut = (t: number) => {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };

  const step = () => {
    if (cancelled) return;

    const elapsed = now() - start;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = easeInOut(progress);

    viewer.setViewBox?.({
      x: lerp(from.x, to.x, eased),
      y: lerp(from.y, to.y, eased),
      w: lerp(from.w, to.w, eased),
      h: lerp(from.h, to.h, eased),
    });

    if (progress < 1) {
      rafHandle = rAF(step);
    } else {
      viewer.setViewBox?.(to);
      rafHandle = null;
    }
  };

  rafHandle = rAF(step);

  // Return cancel function
  return () => {
    cancelled = true;
    if (rafHandle !== null && cAF) {
      cAF(rafHandle);
      rafHandle = null;
    }
  };
};

/**
 * Smoothly animates layer opacities from fromOpacities to toOpacities
 * @param viewer - Viewer API instance
 * @param fromOpacities - Initial opacities map
 * @param toOpacities - Target opacities map
 * @param durationMs - Animation duration in milliseconds (default: 1000ms)
 * @param deps - Runtime dependencies for testing
 */
export const animateLayerOpacities = (
  viewer: ViewerApi,
  fromOpacities: Record<string, number>,
  toOpacities: Record<string, number>,
  durationMs = 1000,
  deps: AnimationDeps = {},
): (() => void) => {
  const now = deps.now ?? (() => Date.now());
  const rAF =
    deps.requestAnimationFrame ??
    (typeof globalThis !== 'undefined' && globalThis.requestAnimationFrame
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : null);
  const cAF =
    deps.cancelAnimationFrame ??
    (typeof globalThis !== 'undefined' && globalThis.cancelAnimationFrame
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : null);

  if (!rAF) {
    // Fallback: immediate update
    for (const [id, opacity] of Object.entries(toOpacities)) {
      viewer.updateLayerOpacity?.(id, opacity);
    }
    return () => {};
  }

  const layers = viewer.getMediaSources?.() ?? [];
  const baseLayerId = layers[0]?.id;
  const getOpacityDefault = (id: string) => (id === baseLayerId ? 1.0 : 0.0);

  const allKeys = Array.from(
    new Set([
      ...Object.keys(fromOpacities),
      ...Object.keys(toOpacities),
      ...layers.map((l) => l.id),
    ]),
  );



  const fullFrom: Record<string, number> = {};
  const fullTo: Record<string, number> = {};
  for (const key of allKeys) {
    const def = getOpacityDefault(key);
    fullFrom[key] = fromOpacities[key] ?? def;
    fullTo[key] = toOpacities[key] ?? def;
  }

  const startTime = now();
  let rafHandle: number | null = null;
  let cancelled = false;

  const easeInOut = (t: number) => {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };

  const step = () => {
    if (cancelled) return;

    const elapsed = now() - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = easeInOut(progress);



    for (const key of allKeys) {
      const startOpacity = fullFrom[key];
      const targetOpacity = fullTo[key];
      const currentOpacity = startOpacity + (targetOpacity - startOpacity) * eased;

      viewer.updateLayerOpacity?.(key, currentOpacity);
    }

    if (progress < 1) {
      rafHandle = rAF(step);
    } else {
      for (const key of allKeys) {
        viewer.updateLayerOpacity?.(key, fullTo[key]);
      }
      rafHandle = null;
    }
  };

  rafHandle = rAF(step);

  return () => {
    cancelled = true;
    if (rafHandle !== null && cAF) {
      cAF(rafHandle);
      rafHandle = null;
    }
  };
};
