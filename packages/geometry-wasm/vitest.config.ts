import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // WASM instantiation needs a little more headroom than the default.
    testTimeout: 20000,
  },
});
