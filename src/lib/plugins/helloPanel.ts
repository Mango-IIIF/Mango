import { translate } from '../i18n';
import type { ViewerPlugin } from '../core/types/plugin';

const createButton = (label: string, className: string) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
};

export const createPlugin = (): ViewerPlugin => {
  let cleanup: (() => void) | null = null;

  return {
    id: 'hello-panel',
    label: translate('plugins.hello.label'),
    slot: 'right',
    init(ctx) {
      const state = ctx.viewer.getState();
      const wrapper = document.createElement('div');
      wrapper.className = 'hello-panel';

      const title = document.createElement('div');
      title.textContent =
        state?.manifestId || translate('plugins.hello.noManifest');
      title.className = 'hello-panel__title';

      const canvas = document.createElement('div');
      canvas.className = 'hello-panel__meta';
      canvas.textContent =
        state?.canvasLabel ||
        translate('viewer.gallery.canvasAlt', {
          index: (state?.canvasIndex ?? 0) + 1,
        });

      const nextButton = createButton(
        translate('plugins.hello.nextCanvas'),
        'hello-panel__button',
      );
      const handler = () => {
        const latest = ctx.viewer.getState();
        if (!latest) return;
        ctx.viewer.setCanvasByIndex(latest.canvasIndex + 1);
      };
      nextButton.addEventListener('click', handler);

      wrapper.append(title, canvas, nextButton);
      ctx.mount.append(wrapper);

      cleanup = () => {
        nextButton.removeEventListener('click', handler);
        wrapper.remove();
      };
    },
    destroy() {
      cleanup?.();
      cleanup = null;
    },
  };
};

export const createHelloPanelPlugin = createPlugin;
