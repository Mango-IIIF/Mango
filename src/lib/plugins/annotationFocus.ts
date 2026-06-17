import type { ViewerPlugin } from '../core/types/plugin';
import { padViewBox, resolveAnnotationViewBox } from '../viewer/annotations/focus';

export const createPlugin = (): ViewerPlugin => {
  let unsubscribe: (() => void) | null = null;

  return {
    id: 'annotation-focus',
    label: 'Annotation Focus',
    slot: 'overlay',
    init(ctx) {
      unsubscribe = ctx.events.on('annotationSelect', (payload) => {
        if (payload.preventZoom) return;
        const annotation = payload.annotation;
        if (!annotation) return;
        const current = ctx.viewer.getViewBox();
        const box = resolveAnnotationViewBox(annotation, current);
        if (!box || box.w === 0 || box.h === 0) return;
        ctx.viewer.setViewBox(padViewBox(box));
      });
    },
    destroy() {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
};

export const createAnnotationFocusPlugin = createPlugin;
