import type { Vec2 } from 'scene';
import type { Toolpath } from './toolpath';

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const first = (tp: Toolpath): Vec2 => tp.points[0];
const last = (tp: Toolpath): Vec2 => tp.points[tp.points.length - 1];

function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Nesting depth of each closed path (how many closed paths contain it). */
function containmentDepth(paths: Toolpath[]): number[] {
  return paths.map((tp) => {
    if (!tp.closed || tp.points.length === 0) return 0;
    const p = tp.points[0];
    let depth = 0;
    for (const other of paths) {
      if (other === tp || !other.closed) continue;
      if (pointInPolygon(p, other.points)) depth += 1;
    }
    return depth;
  });
}

export interface OrderOptions {
  /** Cut deeper-nested (inner) closed paths before their containers. Default true. */
  innerFirst?: boolean;
  from?: Vec2;
}

/** Total rapid-travel distance for a sequence of toolpaths from `from`. */
export function totalTravel(paths: Toolpath[], from: Vec2 = { x: 0, y: 0 }): number {
  let cursor = from;
  let travel = 0;
  for (const tp of paths) {
    if (tp.points.length === 0) continue;
    travel += dist(cursor, first(tp));
    cursor = last(tp);
  }
  return travel;
}

/**
 * Greedy nearest-neighbour ordering that reduces rapid travel while respecting
 * inner-before-outer (so a cut-out part isn't freed before its detail is cut).
 * Deterministic for a given input.
 */
export function optimizeOrder(paths: Toolpath[], opts: OrderOptions = {}): Toolpath[] {
  const innerFirst = opts.innerFirst ?? true;
  const depth = innerFirst ? containmentDepth(paths) : paths.map(() => 0);
  const remaining = paths.map((tp, i) => ({ tp, depth: depth[i] }));
  const result: Toolpath[] = [];
  let cursor = opts.from ?? { x: 0, y: 0 };

  while (remaining.length > 0) {
    const maxDepth = Math.max(...remaining.map((r) => r.depth));
    let bestK = -1;
    let bestD = Infinity;
    let reverse = false;
    for (let k = 0; k < remaining.length; k++) {
      if (remaining[k].depth !== maxDepth) continue;
      const tp = remaining[k].tp;
      const dStart = dist(cursor, first(tp));
      if (dStart < bestD) {
        bestD = dStart;
        bestK = k;
        reverse = false;
      }
      if (!tp.closed) {
        const dEnd = dist(cursor, last(tp));
        if (dEnd < bestD) {
          bestD = dEnd;
          bestK = k;
          reverse = true;
        }
      }
    }
    const chosen = remaining.splice(bestK, 1)[0].tp;
    const path = reverse ? { ...chosen, points: [...chosen.points].reverse() } : chosen;
    result.push(path);
    cursor = last(path);
  }
  return result;
}
