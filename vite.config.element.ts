import { join, resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

if (
  typeof globalThis.crypto === 'undefined' ||
  typeof globalThis.crypto.getRandomValues !== 'function'
) {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
}

const customElementConfig = (filename: string | undefined) => {
  if (filename?.includes('ViewerElement.svelte')) {
    return { customElement: true };
  }
  return {};
};

export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [
    svelte({
      configFile: resolve(import.meta.dirname, 'svelte.config.js'),
      dynamicCompileOptions({ filename }) {
        return customElementConfig(filename);
      },
    }),
    {
      name: 'mango-element-shadow-css',
      enforce: 'post',
      generateBundle(_options, bundle) {
        const jsChunk = bundle['mango-viewer-element.js'];
        const cssAsset = bundle['mango-viewer-element.css'];
        if (jsChunk?.type !== 'chunk' || cssAsset?.type !== 'asset') return;
        if (jsChunk.code.includes('/* mango-css-injected */')) return;

        const css =
          typeof cssAsset.source === 'string'
            ? cssAsset.source
            : Buffer.from(cssAsset.source).toString('utf8');
        jsChunk.code += `\n/* mango-css-injected */\n;if (typeof window !== 'undefined' && window.__setMangoViewerCss) { window.__setMangoViewerCss(${JSON.stringify(css)}); }`;
      },
      writeBundle(_options, bundle) {
        const standaloneDir = resolve(import.meta.dirname, 'src/dist/standalone');
        if (!existsSync(standaloneDir)) return;
        for (const entry of readdirSync(standaloneDir)) {
          if (!(`standalone/${entry}` in bundle)) {
            rmSync(join(standaloneDir, entry), { recursive: true, force: true });
          }
        }
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/lib/element.ts'),
      name: 'MangoViewerElement',
      formats: ['es'],
      fileName: () => 'mango-viewer-element.js',
    },
    rolldownOptions: {
      output: {
        chunkFileNames: 'standalone/[name]-[hash].js',
        assetFileNames: 'mango-viewer-element.[ext]',
      },
    },
    outDir: resolve(import.meta.dirname, 'src/dist'),
    emptyOutDir: false,
    cssCodeSplit: false,
  },
});
