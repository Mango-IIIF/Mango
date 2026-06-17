import type { AnnotationRect } from '../iiif/annotationResolver';
import { translate } from '../i18n';
import type { ViewerPlugin } from '../core/types/plugin';

const createButton = (label: string, className: string) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
};

const rectFromViewBox = (
  viewBox: { x: number; y: number; w: number; h: number } | null,
): AnnotationRect => {
  if (!viewBox) {
    return { x: 100, y: 100, w: 220, h: 180 };
  }
  return {
    x: viewBox.x + viewBox.w * 0.3,
    y: viewBox.y + viewBox.h * 0.3,
    w: viewBox.w * 0.3,
    h: viewBox.h * 0.3,
  };
};

export const createPlugin = (): ViewerPlugin => {
  let cleanup: (() => void) | null = null;

  return {
    id: 'add-annotation',
    label: translate('plugins.annotation.label'),
    slot: 'bottom',
    init(ctx) {
      const wrapper = document.createElement('div');
      wrapper.className = 'annotation-plugin';

      const note = document.createElement('div');
      note.textContent = translate('plugins.annotation.note');
      note.className = 'annotation-plugin__note';

      const button = createButton(
        translate('plugins.annotation.button'),
        'annotation-plugin__button',
      );
      const handler = () => {
        const rect = rectFromViewBox(ctx.viewer.getViewBox());
        void ctx.viewer.addAnnotation({
          rect,
          text: translate('plugins.annotation.added'),
        });
      };
      button.addEventListener('click', handler);

      wrapper.append(note, button);
      ctx.mount.append(wrapper);

      cleanup = () => {
        button.removeEventListener('click', handler);
        wrapper.remove();
      };
    },
    destroy() {
      cleanup?.();
      cleanup = null;
    },
  };
};

export const createAddAnnotationPlugin = createPlugin;
