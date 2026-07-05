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
    console.log('[Browser Inject] injectViewerCss called for:', host, 'attempts left:', attempts);
    const root = host && host.shadowRoot;
    if (!root) {
      console.log('[Browser Inject] shadowRoot not found yet.');
      if (attempts > 0) requestAnimationFrame(() => injectViewerCss(host, attempts - 1));
      return;
    }
    
    // Adopted Stylesheets is completely immune to VDOM clearing/updates
    if (typeof window !== 'undefined' && 'adoptedStyleSheets' in root && typeof CSSStyleSheet !== 'undefined') {
      if (root.__mangoCssAdopted) {
        console.log('[Browser Inject] CSSStyleSheet already adopted.');
        return;
      }
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        root.__mangoCssAdopted = true;
        console.log('[Browser Inject] Successfully adopted CSSStyleSheet.');
        return;
      } catch (e) {
        console.warn('[Browser Inject] AdoptedStyleSheets failed, falling back to tag:', e);
      }
    }

    const inject = () => {
      if (root.querySelector('style[data-mango-viewer-css]')) {
        console.log('[Browser Inject] style already exists in shadowRoot.');
        return;
      }
      const style = document.createElement('style');
      style.dataset.mangoViewerCss = styleId;
      style.textContent = cssText;
      root.prepend(style);
      console.log('[Browser Inject] prepended style tag to shadowRoot.');
    };

    inject();

    if (!root.__mangoCssObserver) {
      console.log('[Browser Inject] Setting up MutationObserver on shadowRoot.');
      root.__mangoCssObserver = new MutationObserver((mutations) => {
        console.log('[Browser Inject] MutationObserver fired on shadowRoot:', mutations);
        inject();
      });
      root.__mangoCssObserver.observe(root, { childList: true });
    }
  }

  if (typeof window !== 'undefined') {
    window.__injectMangoViewerCss = injectViewerCss;

    // Immediately inject to any existing elements in the DOM
    document.querySelectorAll('mango-viewer').forEach((host) => {
      console.log('[Browser Inject] Injecting CSS to existing host:', host);
      injectViewerCss(host);
    });
  }
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
        const jsPath = resolve(__dirname, 'src/dist/mango-viewer-element.js');
        const cssPath = resolve(__dirname, 'src/dist/mango-viewer-element.css');

        console.log('[CSS Inject] Checking files:', jsPath, cssPath);
        console.log('[CSS Inject] JS Exists:', existsSync(jsPath));
        console.log('[CSS Inject] CSS Exists:', existsSync(cssPath));

        if (!existsSync(jsPath) || !existsSync(cssPath)) return;

        const js = readFileSync(jsPath, 'utf8');
        console.log('[CSS Inject] Already Patched?', js.includes('mango-viewer-css'));
        if (js.includes('mango-viewer-css')) return;

        const css = readFileSync(cssPath, 'utf8');
        console.log('[CSS Inject] Injecting CSS of length:', css.length);
        writeFileSync(jsPath, `${js}\n${createCssInjector(css)}`);
        console.log('[CSS Inject] Successfully injected CSS!');
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/element.ts'),
      name: 'MangoViewerElement',
      formats: ['es'],
      fileName: () => 'mango-viewer-element.js',
    },
    rolldownOptions: {
      output: {
        assetFileNames: 'mango-viewer-element.[ext]',
      },
    },
    outDir: resolve(__dirname, 'src/dist'),
    emptyOutDir: false,
    cssCodeSplit: false,
  },
});
