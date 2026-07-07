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
      closeBundle() {
        const jsPath = resolve(__dirname, 'src/dist/mango-viewer-element.js');
        const cssPath = resolve(__dirname, 'src/dist/mango-viewer-element.css');

        console.log('[CSS Inject] Checking files:', jsPath, cssPath);
        const jsExists = existsSync(jsPath);
        const cssExists = existsSync(cssPath);
        console.log('[CSS Inject] JS Exists:', jsExists, 'CSS Exists:', cssExists);

        if (!jsExists || !cssExists) return;

        const js = readFileSync(jsPath, 'utf8');
        const alreadyPatched = js.includes('/* mango-css-injected */');
        console.log('[CSS Inject] Already Patched?', alreadyPatched);
        if (alreadyPatched) return;

        const css = readFileSync(cssPath, 'utf8');
        console.log('[CSS Inject] Injecting CSS of length:', css.length);
        writeFileSync(
          jsPath,
          `${js}\n/* mango-css-injected */\n;if (typeof window !== 'undefined' && window.__setMangoViewerCss) { window.__setMangoViewerCss(${JSON.stringify(css)}); }`
        );
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
