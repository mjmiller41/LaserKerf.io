/**
 * Storage persistence. Chromium can evict origin data under pressure; calling
 * `navigator.storage.persist()` opts out. Installing the PWA auto-grants
 * persistence in Chrome/Edge with no prompt (feasibility §5), so in practice
 * these are best-effort wrappers with graceful feature detection.
 */

function hasStorageManager(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage !== 'undefined';
}

export interface PersistenceInfo {
  supported: boolean;
  persisted: boolean;
}

/** Request durable (non-evictable) storage. Returns whether it is now granted. */
export async function requestPersistence(): Promise<boolean> {
  if (!hasStorageManager() || typeof navigator.storage.persist !== 'function') {
    return false;
  }
  return navigator.storage.persist();
}

/** Whether storage is currently persisted. */
export async function isPersisted(): Promise<boolean> {
  if (!hasStorageManager() || typeof navigator.storage.persisted !== 'function') {
    return false;
  }
  return navigator.storage.persisted();
}

export async function persistenceInfo(): Promise<PersistenceInfo> {
  const supported = hasStorageManager() && typeof navigator.storage.persist === 'function';
  const persisted = supported ? await isPersisted() : false;
  return { supported, persisted };
}

/** Best-effort quota/usage estimate, or null when unsupported. */
export async function storageEstimate(): Promise<StorageEstimate | null> {
  if (!hasStorageManager() || typeof navigator.storage.estimate !== 'function') {
    return null;
  }
  return navigator.storage.estimate();
}
