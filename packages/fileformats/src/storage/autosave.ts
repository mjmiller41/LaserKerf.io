import type { OpfsBlobStore } from './opfs';

/**
 * Crash-safe autosave (development-plan §4.7). Edits call `schedule()`; writes
 * are debounced and land as an OPFS snapshot. Because OPFS survives a crash/tab
 * kill but in-memory state does not, a fresh `Autosave` over the same store can
 * `recover()` the last snapshot — that asymmetry is exactly what the crash test
 * simulates.
 */
export interface AutosaveOptions {
  /** Coalescing window in ms. Default 800. */
  debounceMs?: number;
}

export class Autosave {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private readonly debounceMs: number;

  constructor(
    private readonly blobs: OpfsBlobStore,
    private readonly projectId: string,
    private readonly snapshot: () => Uint8Array | Promise<Uint8Array>,
    opts: AutosaveOptions = {},
  ) {
    this.debounceMs = opts.debounceMs ?? 800;
  }

  private get key(): string {
    return `autosave__${this.projectId}`;
  }

  /** Mark the document dirty and (re)arm the debounced write. */
  schedule(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }

  /** Force any pending snapshot to disk now. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const bytes = await this.snapshot();
    await this.blobs.writeBlob(this.key, bytes);
  }

  /** Recover the last autosaved snapshot, or null if none exists. */
  async recover(): Promise<Uint8Array | null> {
    if (await this.blobs.has(this.key)) {
      return this.blobs.readBlob(this.key);
    }
    return null;
  }

  /** Drop the autosave snapshot (e.g. after a clean save). */
  async clear(): Promise<void> {
    await this.blobs.deleteBlob(this.key);
  }

  /** Cancel any pending write without flushing. */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
