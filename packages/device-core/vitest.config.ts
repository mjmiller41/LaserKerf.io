import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' environment (no DOM) enforces the invariant that device-core has
    // zero DOM/UI dependencies — if any DOM global leaked in, these tests break.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
