import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPersisted, persistenceInfo, requestPersistence, storageEstimate } from './persist';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistence wrappers', () => {
  it('degrade to false/null when StorageManager is unavailable', async () => {
    vi.stubGlobal('navigator', {}); // no `storage`
    expect(await requestPersistence()).toBe(false);
    expect(await isPersisted()).toBe(false);
    expect(await storageEstimate()).toBeNull();
    expect(await persistenceInfo()).toEqual({ supported: false, persisted: false });
  });

  it('report the granted state (the PWA-install auto-grant path)', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: vi.fn(async () => true),
        persisted: vi.fn(async () => true),
        estimate: vi.fn(async () => ({ usage: 10, quota: 1000 })),
      },
    });
    expect(await requestPersistence()).toBe(true);
    expect(await isPersisted()).toBe(true);
    expect(await storageEstimate()).toEqual({ usage: 10, quota: 1000 });
    expect(await persistenceInfo()).toEqual({ supported: true, persisted: true });
  });

  it('handle a StorageManager that exposes no methods', async () => {
    vi.stubGlobal('navigator', { storage: {} });
    expect(await requestPersistence()).toBe(false);
    expect(await persistenceInfo()).toEqual({ supported: false, persisted: false });
  });
});
