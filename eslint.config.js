import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    'coverage',
    'public/data',
    'node_modules',
    'design',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Allow intentionally-unused args/vars when underscore-prefixed (public API
      // params kept for future options, discarded catch bindings, etc.).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // ENGINE PURITY LAW (spec §6) enforced at lint time: /src/engine is pure — no
  // framework/storage imports, no wall-clock, no randomness. Time and storage are
  // passed in as arguments. This is the centerpiece invariant; make it un-violable.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            'react',
            'react-dom',
            'dexie',
            'dexie-react-hooks',
            'zustand',
          ],
          patterns: ['../db/*', '../features/*', '../components/*'],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            'Engine is pure: no wall-clock. Pass timestamps in as arguments.',
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            'Engine is pure: no Date.now(). Pass timestamps in as arguments.',
        },
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'Engine is pure: no Math.random(). Determinism is required for tests.',
        },
      ],
    },
  },
  // Node-context files (build tooling + the exercise pipeline).
  {
    files: ['vite.config.ts', 'pwa-assets.config.ts', 'scripts/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Must be last: turns off ESLint rules that conflict with Prettier.
  eslintConfigPrettier,
]);
