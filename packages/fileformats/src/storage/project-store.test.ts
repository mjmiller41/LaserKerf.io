import { describe, expect, it } from 'vitest';
import { OpfsBlobStore } from './opfs';
import { MemoryDirectoryHandle } from './memory-opfs';
import { MetaStore } from './idb';
import { ProjectStore } from './project-store';

let n = 0;
const newStore = async (): Promise<ProjectStore> =>
  new ProjectStore(
    new OpfsBlobStore(
      new MemoryDirectoryHandle() as unknown as FileSystemDirectoryHandle,
      'projects',
    ),
    await MetaStore.open(`proj-db-${n++}`),
  );

describe('ProjectStore', () => {
  it('saves and loads a project (OPFS blob + IDB metadata together)', async () => {
    const store = await newStore();
    const bytes = new TextEncoder().encode('project payload');
    const meta = await store.save('p1', 'My Project', bytes, 1, 1000);
    expect(meta.sizeBytes).toBe(bytes.byteLength);
    expect(meta.blobKey).toBe('project__p1');

    const loaded = await store.load('p1');
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.name).toBe('My Project');
    expect(new TextDecoder().decode(loaded!.bytes)).toBe('project payload');

    expect(await store.load('missing')).toBeNull();
  });

  it('preserves createdAt across updates and lists by recency', async () => {
    const store = await newStore();
    await store.save('a', 'A', new Uint8Array([1]), 1, 1000);
    await store.save('b', 'B', new Uint8Array([2]), 1, 2000);
    const updated = await store.save('a', 'A2', new Uint8Array([1, 1]), 1, 3000);

    expect(updated.createdAt).toBe(1000); // creation time preserved
    expect(updated.updatedAt).toBe(3000);
    expect((await store.list()).map((m) => m.id)).toEqual(['a', 'b']); // a is newest
  });

  it('removes blob and metadata together', async () => {
    const store = await newStore();
    await store.save('x', 'X', new Uint8Array([9]), 1, 1000);
    await store.remove('x');
    expect(await store.load('x')).toBeNull();
    expect(await store.list()).toEqual([]);
  });
});
