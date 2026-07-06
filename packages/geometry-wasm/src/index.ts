/**
 * geometry-wasm — Clipper2 (C++ -> WASM) boolean/offset geometry.
 * The app should use `createGeometryClient()` so work runs off the main thread;
 * the bare functions are exported for tests and headless callers.
 */
export type { Point, Ring, Polygons, FillRuleName, BooleanOpKind } from './types';
export { polygonArea, totalAbsArea } from './poly';
export { initClipper, union, difference, intersection, xor, offset } from './clipper';
export { createGeometryClient, type GeometryClient } from './client';
export type { GeometryApi } from './geometry-api';
