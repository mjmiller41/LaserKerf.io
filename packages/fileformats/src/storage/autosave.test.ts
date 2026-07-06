import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpfsBlobStore } from './opfs';
import { MemoryDirectoryHandle } from './memory-opfs';
import { Autosave } from './autosave';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array): string => new TextDecoder().decode(b);
const opfs = (root = new MemoryDirectoryHandle()): OpfsBlobStore =>
  new OpfsBlobStore(root as unknown as FileSystemDirectoryHandle);

describe('Autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces rapid edits into a single snapshot of the latest state', async () => {
    const store = opfs();
    let doc = 'v1';
    const snap = vi.fn(() => enc(doc));
    const autosave = new Autosave(store, 'p1', snap, { debounceMs: 500 });

    autosave.schedule();
    doc = 'v2';
    autosave.schedule();
    doc = 'v3';
    autosave.schedule();
    expect(snap).not.toHaveBeenCalled(); // still inside the debounce window

    await vi.advanceTimersByTimeAsync(500);
    expect(snap).toHaveBeenCalledTimes(1);
    expect(dec((await autosave.recover())!)).toBe('v3');
  });

  it('recovers the last snapshot after a simulated crash', async () => {
    const root = new MemoryDirectoryHandle();
    let doc = 'hello';
    const autosave = new Autosave(opfs(root), 'proj', () => enc(doc), { debounceMs: 300 });

    autosave.schedule();
    doc = 'hello world';
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(300);

    // "Crash": discard the Autosave instance and the in-memory document.
    autosave.dispose();

    // A fresh session over the SAME OPFS root recovers the snapshot.
    const revived = new Autosave(opfs(root), 'proj', () => new Uint8Array());
    const recovered = await revived.recover();
    expect(recovered).not.toBeNull();
    expect(dec(recovered!)).toBe('hello world');
  });

  it('clear() removes the snapshot', async () => {
    const store = opfs();
    const autosave = new Autosave(store, 'p', () => enc('x'), { debounceMs: 100 });
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(100);
    expect(await autosave.recover()).not.toBeNull();

    await autosave.clear();
    expect(await autosave.recover()).toBeNull();
  });
});
