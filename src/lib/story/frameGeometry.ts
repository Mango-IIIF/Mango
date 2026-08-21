import type { ViewBox } from '../core/types/viewer';

/*
 * Geometry for the chapter frame: a rectangle on the canvas, in canvas pixels,
 * whose shape is locked to the story's presentation aspect.
 *
 * The lock is what makes the frame a region every reader is guaranteed to see.
 * Left free, a handle drag would reintroduce per-chapter aspects and with them
 * the chapter-to-chapter zoom drift that `framing.ts` exists to remove. So a
 * resize is corrected here, during the gesture, rather than normalised after
 * it: what the author sees while dragging is what will be stored.
 */

export type FrameBounds = { width: number; height: number };

const EDGE_EPSILON = 1e-6;

const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;

const moved = (a: number, b: number, scale: number): boolean =>
  Math.abs(a - b) > Math.max(EDGE_EPSILON, scale * 1e-9);

/**
 * The rectangle of `aspect` that a resize gesture from `before` to `after`
 * should produce.
 *
 * The edges that did not move between the two are the anchor:
 *
 * - a corner drag keeps the opposite corner and sizes the box by the pointer's
 *   projection onto the aspect's diagonal, so both axes of the drag count and
 *   the corner stays under the pointer as nearly as the lock allows — pulling
 *   mostly sideways still shrinks or grows the frame, rather than the frame
 *   holding its height and ignoring the hand;
 * - an edge drag keeps the opposite edge, derives the other dimension from the
 *   aspect, and keeps the box centred on the axis the handle did not touch;
 * - no edge moved — a plain move — and the box is returned as it came.
 *
 * With `bounds`, the result is also kept inside the canvas without breaking
 * the lock: it is shifted back in where it merely hangs over an edge, and
 * shrunk towards its anchor where it is too large to fit.
 */
export const lockRectAspect = (
  before: ViewBox,
  after: ViewBox,
  aspect: number,
  bounds?: FrameBounds | null,
): ViewBox => {
  if (!isPositive(aspect) || !isPositive(after.w) || !isPositive(after.h)) return after;

  const scale = Math.max(before.w, before.h, after.w, after.h);
  const beforeRight = before.x + before.w;
  const beforeBottom = before.y + before.h;
  const afterRight = after.x + after.w;
  const afterBottom = after.y + after.h;

  const leftMoved = moved(after.x, before.x, scale);
  const rightMoved = moved(afterRight, beforeRight, scale);
  const topMoved = moved(after.y, before.y, scale);
  const bottomMoved = moved(afterBottom, beforeBottom, scale);

  const horizontal = leftMoved !== rightMoved;
  const vertical = topMoved !== bottomMoved;

  // Both edges of an axis moving together is a translation on that axis.
  if (!horizontal && !vertical) {
    return bounds ? clampFrameToBounds(after, bounds) : after;
  }

  let width: number;
  let height: number;
  if (horizontal && vertical) {
    // Corner: project the dragged size onto the diagonal (aspect, 1).
    height = Math.max(0, (after.w * aspect + after.h) / (aspect * aspect + 1));
    width = height * aspect;
  } else if (horizontal) {
    width = after.w;
    height = width / aspect;
  } else {
    height = after.h;
    width = height * aspect;
  }

  // Anchor: the edge that stayed, or the untouched axis's centre.
  const x = horizontal
    ? leftMoved
      ? afterRight - width
      : after.x
    : before.x + before.w / 2 - width / 2;
  const y = vertical
    ? topMoved
      ? afterBottom - height
      : after.y
    : before.y + before.h / 2 - height / 2;

  const locked: ViewBox = { x, y, w: width, h: height };
  if (!bounds) return locked;

  const anchorX: 'left' | 'right' | 'centre' = horizontal
    ? leftMoved
      ? 'right'
      : 'left'
    : 'centre';
  const anchorY: 'top' | 'bottom' | 'centre' = vertical
    ? topMoved
      ? 'bottom'
      : 'top'
    : 'centre';
  return fitFrameInBounds(locked, aspect, bounds, anchorX, anchorY);
};

/**
 * Moves a box inside the canvas, and clamps each side to the canvas where the
 * box is larger than it. Used for plain moves, where the shape is already
 * right and only the position can be wrong.
 */
export const clampFrameToBounds = (box: ViewBox, bounds: FrameBounds): ViewBox => {
  if (!isPositive(bounds.width) || !isPositive(bounds.height)) return box;
  const w = Math.min(box.w, bounds.width);
  const h = Math.min(box.h, bounds.height);
  return {
    x: Math.min(Math.max(box.x, 0), bounds.width - w),
    y: Math.min(Math.max(box.y, 0), bounds.height - h),
    w,
    h,
  };
};

/**
 * Shrinks an aspect-locked box until it fits the canvas, towards its anchor,
 * then shifts it inside. Shrinking keeps the lock; a per-side clamp would not.
 *
 * The room available is measured from the anchor, not from the canvas as a
 * whole: a box anchored at its top-left corner can only grow into what lies
 * right of and below that corner, so that is what bounds it.
 */
const fitFrameInBounds = (
  box: ViewBox,
  aspect: number,
  bounds: FrameBounds,
  anchorX: 'left' | 'right' | 'centre',
  anchorY: 'top' | 'bottom' | 'centre',
): ViewBox => {
  if (!isPositive(bounds.width) || !isPositive(bounds.height)) return box;

  const right = box.x + box.w;
  const bottom = box.y + box.h;
  const centreX = box.x + box.w / 2;
  const centreY = box.y + box.h / 2;

  const roomX =
    anchorX === 'left'
      ? bounds.width - Math.max(0, box.x)
      : anchorX === 'right'
        ? Math.min(right, bounds.width)
        : bounds.width;
  const roomY =
    anchorY === 'top'
      ? bounds.height - Math.max(0, box.y)
      : anchorY === 'bottom'
        ? Math.min(bottom, bounds.height)
        : bounds.height;

  let width = box.w;
  let height = box.h;
  const maxWidth = Math.min(roomX, roomY * aspect);
  if (width > maxWidth) {
    width = Math.max(0, maxWidth);
    height = width / aspect;
  }

  let x =
    anchorX === 'right'
      ? Math.min(right, bounds.width) - width
      : anchorX === 'left'
        ? Math.max(0, box.x)
        : centreX - width / 2;
  let y =
    anchorY === 'bottom'
      ? Math.min(bottom, bounds.height) - height
      : anchorY === 'top'
        ? Math.max(0, box.y)
        : centreY - height / 2;

  x = Math.min(Math.max(x, 0), bounds.width - width);
  y = Math.min(Math.max(y, 0), bounds.height - height);
  return { x, y, w: width, h: height };
};

/**
 * Applies one typed value to a frame without breaking the lock.
 *
 * Typing a width or a height is read as "this big, from the same top-left
 * corner", and the other dimension follows; typing x or y moves the frame.
 * Nothing is re-normalised afterwards, so the number typed is the number kept.
 */
export const applyFrameField = (
  box: ViewBox,
  field: 'x' | 'y' | 'w' | 'h',
  value: number,
  aspect: number,
): ViewBox => {
  if (!Number.isFinite(value)) return box;
  switch (field) {
    case 'x':
      return { ...box, x: value };
    case 'y':
      return { ...box, y: value };
    case 'w':
      if (!isPositive(value)) return box;
      return isPositive(aspect) ? { ...box, w: value, h: value / aspect } : { ...box, w: value };
    case 'h':
      if (!isPositive(value)) return box;
      return isPositive(aspect) ? { ...box, h: value, w: value * aspect } : { ...box, h: value };
  }
};

/**
 * A frame to start a new keyframe from: the reference box shrunk about its
 * centre, so it reads as a distinct nested frame the author can take hold of
 * rather than a second outline on top of the first.
 */
export const nestedFrame = (reference: ViewBox, ratio = 0.8): ViewBox => {
  const w = reference.w * ratio;
  const h = reference.h * ratio;
  return {
    x: reference.x + (reference.w - w) / 2,
    y: reference.y + (reference.h - h) / 2,
    w,
    h,
  };
};
