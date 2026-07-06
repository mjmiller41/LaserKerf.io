import * as Comlink from 'comlink';
import type { GeometryApi } from './geometry-api';

export interface GeometryClient {
  /** Comlink proxy — every call runs in the worker and returns a Promise. */
  readonly api: Comlink.Remote<GeometryApi>;
  /** Tear down the worker. */
  terminate(): void;
}

/**
 * Spawn the geometry worker and return a Comlink-wrapped client. The
 * `new Worker(new URL(...), { type: 'module' })` form is what Vite (and the
 * vitest web-worker shim) recognise to bundle the worker as its own module.
 */
export function createGeometryClient(): GeometryClient {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const api = Comlink.wrap<GeometryApi>(worker);
  return {
    api,
    terminate() {
      worker.terminate();
    },
  };
}
