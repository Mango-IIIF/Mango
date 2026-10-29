import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  resolve: {
    conditions: ['browser'],
  },
  plugins: [
    svelte({
      configFile: resolve(import.meta.dirname, 'svelte.config.js'),
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.test.ts'],
    setupFiles: [resolve(import.meta.dirname, 'src/vitest.setup.ts')],
  },
});
