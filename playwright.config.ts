import { defineConfig, devices } from '@playwright/test';

const PORT = 4319;
const BASE_URL = `http://localhost:${PORT}`;

// Offline invariant + browser e2e. The web server builds and previews the PWA so
// the real service worker + WASM are exercised in Chromium.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm --filter web build && pnpm --filter web preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
