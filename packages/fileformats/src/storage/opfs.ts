/**
 * OPFS-backed blob store. Project binaries live here (not IndexedDB) because
 * OPFS is dramatically faster for large writes — a 100 MB write is ~90 ms on
 * OPFS vs ~850 ms on IndexedDB (feasibility §5). The store depends only on a
 * `FileSystemDirectoryHandle`, injected so it is testable with an in-memory
 * double (see memory-opfs.ts) with no browser present.
 */
export class OpfsBlobStore {
  constructor(
    private readonly root: FileSystemDirectoryHandle,
    private readonly dirName = 'blobs',
  ) {}

  /** Open a store rooted at the real origin-private file system. */
  static async open(dirName = 'blobs'): Promise<OpfsBlobStore> {
    const root = await navigator.storage.getDirectory();
    return new OpfsBlobStore(root, dirName);
  }

  private dir(create: boolean): Promise<FileSystemDirectoryHandle> {
    return this.root.getDirectoryHandle(this.dirName, { create });
  }

  async writeBlob(key: string, data: Uint8Array | Blob): Promise<void> {
    const dir = await this.dir(true);
    const handle = await dir.getFileHandle(key, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data as FileSystemWriteChunkType);
    await writable.close();
  }

  async readBlob(key: string): Promise<Uint8Array> {
    const dir = await this.dir(false);
    const handle = await dir.getFileHandle(key);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  async has(key: string): Promise<boolean> {
    try {
      const dir = await this.dir(false);
      await dir.getFileHandle(key);
      return true;
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number> {
    const dir = await this.dir(false);
    const handle = await dir.getFileHandle(key);
    const file = await handle.getFile();
    return file.size;
  }

  async deleteBlob(key: string): Promise<void> {
    const dir = await this.dir(true);
    try {
      await dir.removeEntry(key);
    } catch {
      // deleting a missing key is a no-op
    }
  }

  async keys(): Promise<string[]> {
    const dir = await this.dir(true);
    const out: string[] = [];
    // `keys()` (async iterator) is present on OPFS dir handles at runtime but is
    // not in every lib.dom version — narrow explicitly.
    const iterable = dir as unknown as { keys(): AsyncIterableIterator<string> };
    for await (const name of iterable.keys()) out.push(name);
    return out;
  }
}
