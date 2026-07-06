import * as Comlink from 'comlink';
import { afterEach, describe, expect, it } from 'vitest';
import { geometryApi, type GeometryApi } from './geometry-api';
import { totalAbsArea } from './poly';
import type { Polygons } from './types';

// Node exposes a global `MessageChannel` whose ports are web-MessagePort-
// compatible (postMessage/addEventListener/start), so they drive Comlink
// directly (typed here via lib.dom, no node types needed). This
// exercises the exact worker API surface and the Comlink serialization boundary
// in-process; the real browser Worker + WASM-off-main-thread path is validated
// end to end in the Playwright suite (e2e/geometry.spec.ts).
const A: Polygons = [
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
];
const B: Polygons = [
  [
    [5, 5],
    [15, 5],
    [15, 15],
    [5, 15],
  ],
];

describe('geometry API over a Comlink boundary', () => {
  let close: (() => void) | null = null;
  afterEach(() => {
    close?.();
    close = null;
  });

  it('proxies union & difference across a message port with correct geometry', async () => {
    const { port1, port2 } = new MessageChannel();
    Comlink.expose(geometryApi, port1 as unknown as Comlink.Endpoint);
    const remote = Comlink.wrap<GeometryApi>(port2 as unknown as Comlink.Endpoint);
    close = () => {
      port1.close();
      port2.close();
    };

    expect(totalAbsArea(await remote.union(A, B))).toBeCloseTo(175, 3);
    expect(totalAbsArea(await remote.difference(A, B))).toBeCloseTo(75, 3);
  });
});
