import { describe, expect, it } from 'vitest';
import { difference, intersection, offset, union } from './clipper';
import { totalAbsArea } from './poly';
import type { Polygons } from './types';

// Two 10x10 squares overlapping in a 5x5 region.
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

describe('Clipper2 boolean ops (WASM)', () => {
  it('union area = 100 + 100 - 25 overlap = 175', async () => {
    const result = await union(A, B);
    expect(totalAbsArea(result)).toBeCloseTo(175, 3);
    expect(result.length).toBeGreaterThan(0);
  });

  it('difference (A - B) removes the 25 overlap = 75', async () => {
    const result = await difference(A, B);
    expect(totalAbsArea(result)).toBeCloseTo(75, 3);
  });

  it('intersection is the 5x5 overlap = 25', async () => {
    const result = await intersection(A, B);
    expect(totalAbsArea(result)).toBeCloseTo(25, 3);
    // the overlap is a single square region
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(4);
  });

  it('offset grows a 10x10 square by 1mm (Minkowski area = 100 + 40 + pi)', async () => {
    const grown = await offset(A, 1);
    // Outward round-join offset by r: area = A + perimeter*r + pi*r^2
    // = 100 + 40 + pi ~= 143.14 (segment-approximated arcs land just under).
    expect(totalAbsArea(grown)).toBeCloseTo(143.14, 1);
  });
});
