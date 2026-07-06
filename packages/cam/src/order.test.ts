import { describe, expect, it } from 'vitest';
import type { Toolpath } from './toolpath';
import { optimizeOrder, totalTravel } from './order';

const line = (x1: number, y1: number, x2: number, y2: number): Toolpath => ({
  points: [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ],
  closed: false,
});

const square = (x: number, y: number, s: number): Toolpath => ({
  points: [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
    { x, y },
  ],
  closed: true,
});

describe('cut-order optimization', () => {
  it('reduces rapid travel versus the naive order', () => {
    // deliberately interleaved so naive order zig-zags
    const naive = [line(0, 0, 1, 0), line(100, 0, 101, 0), line(2, 0, 3, 0), line(102, 0, 103, 0)];
    const optimized = optimizeOrder(naive);
    expect(totalTravel(optimized)).toBeLessThanOrEqual(totalTravel(naive));
  });

  it('cuts an inner shape before the outer one that contains it', () => {
    const outer = square(0, 0, 100);
    const inner = square(40, 40, 20);
    const ordered = optimizeOrder([outer, inner]);
    expect(ordered[0]).toBe(inner);
    expect(ordered[1]).toBe(outer);
  });

  it('is deterministic', () => {
    const paths = [line(5, 5, 6, 5), line(0, 0, 1, 0), line(10, 10, 11, 10)];
    expect(optimizeOrder(paths)).toEqual(optimizeOrder(paths));
  });
});
