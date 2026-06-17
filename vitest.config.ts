import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  resolve: {
    conditions: ['browser'],
  },
  plugins: [
    svelte({
      configFile: resolve(__dirname, 'svelte.config.js'),
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.test.ts'],
  },
});
