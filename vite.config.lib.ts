import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
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
  plugins: [
    svelte({
      configFile: resolve(import.meta.dirname, 'svelte.config.js'),
      dynamicCompileOptions({ filename }) {
        return customElementConfig(filename);
      },
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/lib/index.ts'),
        all: resolve(import.meta.dirname, 'src/lib/all.ts'),
        element: resolve(import.meta.dirname, 'src/lib/element.ts'),
        'element-viewer': resolve(import.meta.dirname, 'src/lib/elements/viewer.ts'),
        'core-viewer': resolve(import.meta.dirname, 'src/lib/core-viewer.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ['svelte', 'svelte/internal', /^svelte\//],
    },
    outDir: resolve(import.meta.dirname, 'src/dist'),
    emptyOutDir: true,
  },
});
