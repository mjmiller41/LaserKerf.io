import type { Polygons, Ring } from './types';

/** Signed area of a ring via the shoelace formula (CCW positive). */
export function polygonArea(ring: Ring): number {
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Sum of absolute ring areas — a winding-agnostic geometry invariant for tests. */
export function totalAbsArea(polys: Polygons): number {
  return polys.reduce((total, ring) => total + Math.abs(polygonArea(ring)), 0);
}
