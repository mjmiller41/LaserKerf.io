import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // OPFS is supplied via an injected in-memory handle; IndexedDB via
    // fake-indexeddb (see vitest.setup.ts). Node 20+ provides Blob/File/
    // TextEncoder/structuredClone globally, so 'node' is sufficient.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
