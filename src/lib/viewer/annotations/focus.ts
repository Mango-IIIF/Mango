import type { ResolvedAnnotation } from '../../iiif/annotationResolver';
import type { ViewBox } from '../../core/types/viewer';

export const resolveAnnotationViewBox = (
  annotation: ResolvedAnnotation,
  currentViewBox: ViewBox | null,
): ViewBox | null => {
  if (annotation.rect) {
    return {
      x: annotation.rect.x,
      y: annotation.rect.y,
      w: annotation.rect.w,
      h: annotation.rect.h,
    };
  }
  if (annotation.polygon?.points?.length) {
    const xs = annotation.polygon.points.map((point) => point.x);
    const ys = annotation.polygon.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    };
  }
  if (annotation.point) {
    const fallbackSize = currentViewBox
      ? Math.max(40, Math.min(currentViewBox.w, currentViewBox.h) * 0.25)
      : 200;
    return {
      x: annotation.point.x - fallbackSize / 2,
      y: annotation.point.y - fallbackSize / 2,
      w: fallbackSize,
      h: fallbackSize,
    };
  }
  return null;
};

export const padViewBox = (box: ViewBox, ratio = 0.12): ViewBox => {
  const padding = Math.max(box.w, box.h) * ratio;
  return {
    x: Math.max(0, box.x - padding),
    y: Math.max(0, box.y - padding),
    w: box.w + padding * 2,
    h: box.h + padding * 2,
  };
};
