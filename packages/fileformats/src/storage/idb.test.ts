import { describe, expect, it } from 'vitest';
import { MetaStore, type ProjectMeta } from './idb';

let counter = 0;
const freshDb = (): string => `test-db-${counter++}`;

const meta = (over: Partial<ProjectMeta>): ProjectMeta => ({
  id: 'p',
  name: 'P',
  createdAt: 1,
  updatedAt: 1,
  sizeBytes: 0,
  blobKey: 'k',
  schemaVersion: 1,
  ...over,
});

describe('MetaStore', () => {
  it('put / get / all / delete', async () => {
    const s = await MetaStore.open(freshDb());
    await s.put(meta({ id: 'a', updatedAt: 10 }));
    await s.put(meta({ id: 'b', updatedAt: 20 }));

    expect((await s.get('a'))?.id).toBe('a');
    expect(await s.get('missing')).toBeUndefined();
    expect((await s.all()).map((m) => m.id).sort()).toEqual(['a', 'b']);

    await s.delete('a');
    expect(await s.get('a')).toBeUndefined();
    s.close();
  });

  it('recent() returns newest-updated first via the updatedAt index', async () => {
    const s = await MetaStore.open(freshDb());
    await s.put(meta({ id: 'old', updatedAt: 100 }));
    await s.put(meta({ id: 'new', updatedAt: 300 }));
    await s.put(meta({ id: 'mid', updatedAt: 200 }));

    expect((await s.recent(2)).map((m) => m.id)).toEqual(['new', 'mid']);
    s.close();
  });
});
