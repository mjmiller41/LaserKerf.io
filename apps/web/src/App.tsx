import { useCallback, useEffect, useState } from 'react';
import { FakeDevice, type DeviceStatus } from 'device-core';
import { ProjectStore, persistenceInfo, requestPersistence } from 'fileformats';
import type { Polygons } from 'geometry-wasm';

/**
 * M0 smoke dashboard. It exists to prove the offline shell wires up the three
 * foundational packages and that each keeps working with the network offline:
 *   - device-core  : FakeDevice streams a job to a simulated controller
 *   - fileformats  : ProjectStore round-trips a blob through OPFS + IndexedDB
 *   - geometry-wasm: Clipper2 boolean op runs in a worker (loaded lazily)
 * The Playwright offline suite drives these buttons after cutting the network.
 */
export function App() {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  const [persist, setPersist] = useState<string>('checking…');
  const [device, setDevice] = useState<string>('idle');
  const [storage, setStorage] = useState<string>('—');
  const [geometry, setGeometry] = useState<string>('—');

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    void persistenceInfo().then((info) =>
      setPersist(info.persisted ? 'persisted' : info.supported ? 'not persisted' : 'unsupported'),
    );
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const runDevice = useCallback(async () => {
    setDevice('running…');
    const dev = new FakeDevice({ msPerLine: 4 });
    await dev.connect();
    const off = dev.onStatus((s: DeviceStatus) =>
      setDevice(`${s.state} ${Math.round(s.progress * 100)}% · buf ${s.bufferUsed}B`),
    );
    const handle = dev.stream({ lines: Array.from({ length: 16 }, (_, i) => `G1 X${i} Y0`) });
    const result = await handle.done;
    off();
    setDevice(`${result.status} ${result.linesSent}/${handle.totalLines}`);
  }, []);

  const runStorage = useCallback(async () => {
    setStorage('saving…');
    try {
      await requestPersistence();
      const store = await ProjectStore.open();
      const payload = new TextEncoder().encode('fluence-m0-smoke');
      await store.save('m0-smoke', 'M0 Smoke', payload);
      const loaded = await store.load('m0-smoke');
      const ok = loaded !== null && new TextDecoder().decode(loaded.bytes) === 'fluence-m0-smoke';
      setStorage(ok ? `roundtrip ok (${loaded!.bytes.byteLength}B, OPFS+IDB)` : 'FAILED');
    } catch (err) {
      setStorage(`error: ${(err as Error).message}`);
    }
  }, []);

  const runGeometry = useCallback(async () => {
    setGeometry('computing…');
    try {
      const { createGeometryClient } = await import('geometry-wasm');
      const client = createGeometryClient();
      const a: Polygons = [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
      ];
      const b: Polygons = [
        [
          [5, 5],
          [15, 5],
          [15, 15],
          [5, 15],
        ],
      ];
      const solution = await client.api.union(a, b);
      client.terminate();
      const area = solution.reduce((sum, ring) => {
        let acc = 0;
        for (let i = 0; i < ring.length; i++) {
          const [x1, y1] = ring[i];
          const [x2, y2] = ring[(i + 1) % ring.length];
          acc += x1 * y2 - x2 * y1;
        }
        return sum + Math.abs(acc / 2);
      }, 0);
      setGeometry(`union area = ${area.toFixed(1)} (expected 175)`);
    } catch (err) {
      setGeometry(`error: ${(err as Error).message}`);
    }
  }, []);

  return (
    <main className="app">
      <header className="app__header">
        <h1 data-testid="app-title">Fluence</h1>
        <p className="app__subtitle">M0 · Foundations smoke dashboard</p>
        <span
          className={`badge ${online ? 'badge--online' : 'badge--offline'}`}
          data-testid="net-status"
        >
          {online ? 'online' : 'offline'}
        </span>
      </header>

      <section className="grid">
        <article className="card">
          <h2>Device (FakeDevice)</h2>
          <p className="card__desc">Stream a G-code job to a simulated controller.</p>
          <button type="button" onClick={() => void runDevice()} data-testid="run-device">
            Stream job
          </button>
          <output data-testid="device-result">{device}</output>
        </article>

        <article className="card">
          <h2>Storage (OPFS + IndexedDB)</h2>
          <p className="card__desc">Save and reload a project blob offline.</p>
          <button type="button" onClick={() => void runStorage()} data-testid="run-storage">
            Save &amp; load
          </button>
          <output data-testid="storage-result">{storage}</output>
        </article>

        <article className="card">
          <h2>Geometry (Clipper2 · worker)</h2>
          <p className="card__desc">Union two squares in a WASM worker.</p>
          <button type="button" onClick={() => void runGeometry()} data-testid="run-geometry">
            Union
          </button>
          <output data-testid="geometry-result">{geometry}</output>
        </article>

        <article className="card">
          <h2>Persistence</h2>
          <p className="card__desc">Durable storage (auto-granted on PWA install).</p>
          <output data-testid="persist-status">{persist}</output>
        </article>
      </section>
    </main>
  );
}
