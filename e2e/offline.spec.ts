import { expect, test } from '@playwright/test';

// The offline invariant (CLAUDE.md invariant 3 / development-plan §4.4, §8):
// after one online load the app must fully function with the network cut —
// including geometry, which runs Clipper2 WASM in a worker from the precache.
test.describe('offline invariant', () => {
  test('@offline shell + device + storage + geometry work with the network blocked', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toHaveText('Fluence');

    // Wait for the service worker to activate, control the page, and precache.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
            once: true,
          });
        });
      }
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const keys = await caches.keys();
        if (keys.length > 0) return;
        await new Promise((r) => setTimeout(r, 100));
      }
    });

    // Cut the network entirely, then reload from the service worker cache.
    await context.setOffline(true);
    await page.reload();

    await expect(page.getByTestId('net-status')).toHaveText('offline');
    await expect(page.getByTestId('app-title')).toHaveText('Fluence');

    // device-core: FakeDevice streams a job offline.
    await page.getByTestId('run-device').click();
    await expect(page.getByTestId('device-result')).toHaveText(/completed 16\/16/, {
      timeout: 15_000,
    });

    // fileformats: OPFS blob + IndexedDB metadata round-trip offline.
    await page.getByTestId('run-storage').click();
    await expect(page.getByTestId('storage-result')).toHaveText(/roundtrip ok/, {
      timeout: 15_000,
    });

    // geometry-wasm: Clipper2 union in a worker from precached WASM, offline.
    await page.getByTestId('run-geometry').click();
    await expect(page.getByTestId('geometry-result')).toHaveText(/union area = 175/, {
      timeout: 20_000,
    });

    await context.setOffline(false);
  });
});
