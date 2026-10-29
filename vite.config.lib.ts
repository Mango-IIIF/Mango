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
  root: resolve(__dirname, 'src'),
  plugins: [
    svelte({
      configFile: resolve(__dirname, 'svelte.config.js'),
      dynamicCompileOptions({ filename }) {
        return customElementConfig(filename);
      },
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/lib/index.ts'),
        all: resolve(__dirname, 'src/lib/all.ts'),
        element: resolve(__dirname, 'src/lib/element.ts'),
        'element-viewer': resolve(__dirname, 'src/lib/elements/viewer.ts'),
        'core-viewer': resolve(__dirname, 'src/lib/core-viewer.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ['svelte', 'svelte/internal', /^svelte\//],
    },
    outDir: resolve(__dirname, 'src/dist'),
    emptyOutDir: true,
  },
});
