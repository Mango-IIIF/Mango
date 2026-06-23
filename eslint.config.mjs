import js from '@eslint/js';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import sveltePlugin from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

const ignores = [
  'node_modules/**',
  '**/dist/**',
  'demo/**',
  'apps/demo/demo/**',
  'spec/**',
  'triiiceratops/**',
  '**/.svelte-kit/**',
];

const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
};

export default [
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      globals: sharedGlobals,
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: sharedGlobals,
    },
    plugins: {
      svelte: sveltePlugin,
    },
    rules: {
      ...sveltePlugin.configs.recommended.rules,
    },
  },
];
