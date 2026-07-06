import { beforeEach, describe, expect, it } from 'vitest';
import { vec } from '../geom/vec';
import { flattenPath } from '../geom/path';
import { createPath, createPolygon, createPolyline, createRect } from './factory';
import { shapeBounds, shapeGeometry } from './shape';
import { resetIds } from './ids';

const init = { layerId: 'ly' };

beforeEach(() => resetIds());

describe('primitive tools', () => {
  it('line (2-point polyline) has exact geometry', () => {
    const line = createPolyline([vec(0, 0), vec(30, 40)], false, init);
    const poly = flattenPath(shapeGeometry(line))[0];
    expect(poly).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 40 },
    ]);
  });

  it('bezier path flattens through its control points', () => {
    const bez = createPath(
      [
        {
          start: vec(0, 0),
          segments: [{ type: 'cubic', c1: vec(0, 10), c2: vec(10, 10), to: vec(10, 0) }],
          closed: false,
        },
      ],
      init,
    );
    const poly = flattenPath(shapeGeometry(bez), 0.01)[0];
    expect(poly[0]).toEqual({ x: 0, y: 0 });
    expect(poly[poly.length - 1]).toEqual({ x: 10, y: 0 });
    expect(poly.length).toBeGreaterThan(3); // subdivided curve
  });

  it('polygon vertex count is exact and editable', () => {
    const p = createPolygon(6, 10, init);
    // 6 vertices -> flattened closed ring has 7 points (repeat start)
    expect(flattenPath(shapeGeometry(p))[0]).toHaveLength(7);
    p.sides = 8;
    expect(flattenPath(shapeGeometry(p))[0]).toHaveLength(9);
  });

  it('rect params are editable and re-derive geometry', () => {
    const r = createRect(20, 10, init);
    expect(shapeBounds(r)).toEqual({ x: 0, y: 0, width: 20, height: 10 });
    r.width = 50;
    r.height = 25;
    expect(shapeBounds(r)).toEqual({ x: 0, y: 0, width: 50, height: 25 });
  });
});
