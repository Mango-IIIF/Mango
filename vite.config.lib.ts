import { copyFileSync, readFileSync } from 'node:fs';
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

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/*
 * Keep runtime dependencies external in the library build so consuming apps and
 * sibling packages (Lychee, Papaya) share one deduplicated copy instead of
 * bundling duplicate multi-MB copies of RAMP, pdfjs-dist, model-viewer, and OSD.
 * `@lucide/svelte` ships uncompiled `.svelte` files, so bundle it here.
 */
const BUNDLED = ['@lucide/svelte'];
const externalPackages = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).filter(
  (name) => !BUNDLED.includes(name),
);
const isExternal = (id: string) =>
  externalPackages.some((name) => id === name || id.startsWith(`${name}/`));

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
    {
      name: 'mango-copy-themes-css',
      closeBundle() {
        copyFileSync(
          resolve(import.meta.dirname, 'src/lib/core/themes.css'),
          resolve(import.meta.dirname, 'src/dist/themes.css'),
        );
      },
    },
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
      external: isExternal,
    },
    outDir: resolve(import.meta.dirname, 'src/dist'),
    emptyOutDir: true,
  },
});
