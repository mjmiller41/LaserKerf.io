// Flat ESLint config, shared by every workspace package.
// ESLint discovers this by walking up from each linted file, so package
// `lint` scripts can just run `eslint .` from their own directory.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // Generated output, vendored binaries, and the Rust crate are never linted.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/dev-dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/target/**',
      '**/node_modules/**',
      '**/*.wasm',
      'packages/geometry-wasm/vendor/**',
      'apps/agent/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.worker,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Comlink transport wiring and WASM glue legitimately need `any`.
      '@typescript-eslint/no-explicit-any': 'off',
      // Path triple-slash references are used deliberately to make a local module
      // shim (clipper2-wasm's broken `types` field) visible to cross-package
      // type-checking. Keep the import preference for lib/types.
      '@typescript-eslint/triple-slash-reference': [
        'error',
        { path: 'always', lib: 'always', types: 'prefer-import' },
      ],
    },
  },
);
