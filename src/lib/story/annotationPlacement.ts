import type { AnnotationPlacement } from '../core/types/story';

type LegacyAnnotationPlacement =
  | 'top-left'
  | 'top-centre'
  | 'top-right'
  | 'centre-left'
  | 'centre'
  | 'centre-right'
  | 'bottom-left'
  | 'bottom-centre'
  | 'bottom-right';

const LEGACY_ANCHORS: Record<LegacyAnnotationPlacement, { x: number; y: number }> = {
  'top-left': { x: 1 / 6, y: 1 / 6 },
  'top-centre': { x: 0.5, y: 1 / 6 },
  'top-right': { x: 5 / 6, y: 1 / 6 },
  'centre-left': { x: 1 / 6, y: 0.5 },
  centre: { x: 0.5, y: 0.5 },
  'centre-right': { x: 5 / 6, y: 0.5 },
  'bottom-left': { x: 1 / 6, y: 5 / 6 },
  'bottom-centre': { x: 0.5, y: 5 / 6 },
  'bottom-right': { x: 5 / 6, y: 5 / 6 },
};

const LEGACY_RECT_SIZE = 0.28;
const DEFAULT_RECT_SIZE = 0.34;
const MIN_RECT_SIZE = 0.01;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeRect = (rect: AnnotationPlacement): AnnotationPlacement => {
  const w = clamp(rect.w, MIN_RECT_SIZE, 1);
  const h = clamp(rect.h, MIN_RECT_SIZE, 1);
  const x = clamp(rect.x, 0, 1 - w);
  const y = clamp(rect.y, 0, 1 - h);
  return { x, y, w, h };
};

const rectFromAnchor = (anchor: { x: number; y: number }, size: number): AnnotationPlacement => {
  const nextSize = clamp(size, MIN_RECT_SIZE, 1);
  return normalizeRect({
    x: anchor.x - nextSize / 2,
    y: anchor.y - nextSize / 2,
    w: nextSize,
    h: nextSize,
  });
};

export const DEFAULT_ANNOTATION_PLACEMENT: AnnotationPlacement = Object.freeze(
  rectFromAnchor({ x: 0.5, y: 0.5 }, DEFAULT_RECT_SIZE),
);

export const isAnnotationPlacement = (value: unknown): value is AnnotationPlacement => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<AnnotationPlacement>;
  if (
    !Number.isFinite(entry.x) ||
    !Number.isFinite(entry.y) ||
    !Number.isFinite(entry.w) ||
    !Number.isFinite(entry.h)
  ) {
    return false;
  }
  const x = entry.x as number;
  const y = entry.y as number;
  const w = entry.w as number;
  const h = entry.h as number;
  return x >= 0 && y >= 0 && w > 0 && h > 0;
};

export const cloneAnnotationPlacement = (
  placement: AnnotationPlacement,
): AnnotationPlacement => ({
  x: placement.x,
  y: placement.y,
  w: placement.w,
  h: placement.h,
});

export const coerceAnnotationPlacement = (
  value: unknown,
): AnnotationPlacement | null => {
  if (isAnnotationPlacement(value)) {
    return cloneAnnotationPlacement(value);
  }

  if (typeof value === 'string') {
    const anchor = LEGACY_ANCHORS[value as LegacyAnnotationPlacement];
    if (anchor) {
      return rectFromAnchor(anchor, LEGACY_RECT_SIZE);
    }
  }

  if (value && typeof value === 'object') {
    const rect = value as Partial<AnnotationPlacement>;
    if (
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      Number.isFinite(rect.w) &&
      Number.isFinite(rect.h)
    ) {
      const rx = rect.x as number;
      const ry = rect.y as number;
      const rw = rect.w as number;
      const rh = rect.h as number;

      const isAbs = rx > 1 || ry > 1 || rw > 1 || rh > 1;
      if (isAbs) {
        return {
          x: Math.max(0, rx),
          y: Math.max(0, ry),
          w: Math.max(0.0001, rw),
          h: Math.max(0.0001, rh)
        };
      } else {
        return normalizeRect({
          x: rx,
          y: ry,
          w: rw,
          h: rh,
        });
      }
    }
  }

  return null;
};
