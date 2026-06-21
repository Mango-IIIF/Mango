import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

if (
  typeof globalThis.crypto === 'undefined' ||
  typeof globalThis.crypto.getRandomValues !== 'function'
) {
  (globalThis as any).crypto = webcrypto;
}

const customElementConfig = (filename: string | undefined) => {
  if (filename?.includes('ViewerElement.svelte')) {
    return { customElement: true };
  }
  return {};
};

const createCssInjector = (cssText: string) => `
;(() => {
  const cssText = ${JSON.stringify(cssText)};
  const styleId = 'mango-viewer-css';

  function injectViewerCss(host, attempts = 12) {
    const root = host && host.shadowRoot;
    if (!root) {
      if (attempts > 0) requestAnimationFrame(() => injectViewerCss(host, attempts - 1));
      return;
    }
    if (root.querySelector('style[data-mango-viewer-css]')) return;
    const style = document.createElement('style');
    style.dataset.mangoViewerCss = styleId;
    style.textContent = cssText;
    root.prepend(style);
  }

  customElements.whenDefined('mango-viewer').then(() => {
    const ViewerElement = customElements.get('mango-viewer');
    if (!ViewerElement || ViewerElement.prototype.__mangoViewerCssPatched) return;

    const connectedCallback = ViewerElement.prototype.connectedCallback;
    ViewerElement.prototype.connectedCallback = function (...args) {
      const result = connectedCallback ? connectedCallback.apply(this, args) : undefined;
      injectViewerCss(this);
      return result;
    };
    ViewerElement.prototype.__mangoViewerCssPatched = true;
    document.querySelectorAll('mango-viewer').forEach((host) => injectViewerCss(host));
  });
})();
`;

export default defineConfig({
  root: resolve(__dirname, 'src'),
  plugins: [
    svelte({
      configFile: resolve(__dirname, 'svelte.config.js'),
      dynamicCompileOptions({ filename }) {
        return customElementConfig(filename);
      },
    }),
    {
      name: 'mango-element-shadow-css',
      writeBundle() {
        const jsPath = resolve(__dirname, 'src/dist/mango-viewer-element.iife.js');
        const cssPath = resolve(__dirname, 'src/dist/mango-viewer-element.css');

        if (!existsSync(jsPath) || !existsSync(cssPath)) return;

        const js = readFileSync(jsPath, 'utf8');
        if (js.includes('mango-viewer-css')) return;

        const css = readFileSync(cssPath, 'utf8');
        writeFileSync(jsPath, `${js}\n${createCssInjector(css)}`);
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/element.ts'),
      name: 'MangoViewerElement',
      formats: ['iife'],
      fileName: () => 'mango-viewer-element.iife.js',
    },
    rolldownOptions: {
      transform: {
        define: {
          'import.meta': '{}',
        },
      },
      output: {
        assetFileNames: 'mango-viewer-element.[ext]',
      },
    },
    outDir: resolve(__dirname, 'src/dist'),
    emptyOutDir: false,
    cssCodeSplit: false,
  },
});
