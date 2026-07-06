/**
 * In-memory implementation of the subset of the OPFS API that `OpfsBlobStore`
 * uses. Purpose: exercise the real storage code path in headless tests (and in
 * any environment without an origin-private file system) with full fidelity to
 * the async, handle-based shape of the File System Access API.
 *
 * It is structurally compatible with `FileSystemDirectoryHandle`; tests pass it
 * to `OpfsBlobStore` via a single `as unknown as FileSystemDirectoryHandle` cast.
 */

async function toBytes(
  chunk: Uint8Array | ArrayBuffer | Blob | DataView | ArrayBufferView | string,
): Promise<Uint8Array> {
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  if (typeof Blob !== 'undefined' && chunk instanceof Blob) {
    return new Uint8Array(await chunk.arrayBuffer());
  }
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk);
  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  throw new TypeError('Unsupported chunk type for write()');
}

function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function notFound(name: string): Error {
  const err = new Error(`NotFoundError: "${name}" was not found`);
  err.name = 'NotFoundError';
  return err;
}

interface MemFile {
  data: Uint8Array;
}

class MemoryWritable {
  private readonly chunks: Uint8Array[];
  constructor(
    private readonly file: MemFile,
    keepExistingData: boolean,
  ) {
    this.chunks = keepExistingData ? [file.data] : [];
  }
  async write(chunk: Uint8Array | ArrayBuffer | Blob | string): Promise<void> {
    this.chunks.push(await toBytes(chunk));
  }
  async close(): Promise<void> {
    this.file.data = concat(this.chunks);
  }
  async seek(): Promise<void> {}
  async truncate(): Promise<void> {}
}

class MemoryFileHandle {
  readonly kind = 'file';
  constructor(
    readonly name: string,
    private readonly file: MemFile,
  ) {}
  async getFile(): Promise<Blob> {
    return new Blob([this.file.data as BlobPart]);
  }
  async createWritable(opts?: { keepExistingData?: boolean }): Promise<MemoryWritable> {
    return new MemoryWritable(this.file, opts?.keepExistingData ?? false);
  }
}

export class MemoryDirectoryHandle {
  readonly kind = 'directory';
  private readonly dirs = new Map<string, MemoryDirectoryHandle>();
  private readonly files = new Map<string, MemFile>();

  constructor(readonly name = '') {}

  async getDirectoryHandle(
    name: string,
    opts?: { create?: boolean },
  ): Promise<MemoryDirectoryHandle> {
    let dir = this.dirs.get(name);
    if (!dir) {
      if (!opts?.create) throw notFound(name);
      dir = new MemoryDirectoryHandle(name);
      this.dirs.set(name, dir);
    }
    return dir;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MemoryFileHandle> {
    let file = this.files.get(name);
    if (!file) {
      if (!opts?.create) throw notFound(name);
      file = { data: new Uint8Array(0) };
      this.files.set(name, file);
    }
    return new MemoryFileHandle(name, file);
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.dirs.delete(name)) {
      throw notFound(name);
    }
  }

  async *keys(): AsyncGenerator<string> {
    yield* this.files.keys();
    yield* this.dirs.keys();
  }
}
