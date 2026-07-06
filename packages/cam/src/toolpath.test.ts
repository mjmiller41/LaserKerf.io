import { describe, expect, it } from 'vitest';
import { createRect, shapeGeometry } from 'scene';
import { fillToolpaths, generateToolpaths, lineToolpaths, offsetFillToolpaths } from './toolpath';
import { defaultCutSettings } from './settings';

const rect = (w: number, h: number) => shapeGeometry(createRect(w, h, { layerId: 'l' }));

describe('cut modes', () => {
  it('line mode cuts the outline exactly', () => {
    const tps = lineToolpaths(rect(10, 10));
    expect(tps).toHaveLength(1);
    expect(tps[0].closed).toBe(true);
    // closed square flattens to 5 points (start repeated)
    expect(tps[0].points).toHaveLength(5);
  });

  it('fill mode makes horizontal scan lines at the interval', () => {
    const tps = fillToolpaths(rect(10, 10), 2, 0);
    // scan lines at y = 0,2,4,6,8 (top edge at y=10 has no interior crossing)
    expect(tps).toHaveLength(5);
    for (const tp of tps) {
      expect(tp.points).toHaveLength(2);
      expect(tp.points[0].x).toBeCloseTo(0, 6);
      expect(tp.points[1].x).toBeCloseTo(10, 6);
    }
  });

  it('fill respects the scan angle', () => {
    const straight = fillToolpaths(rect(10, 10), 1, 0);
    const angled = fillToolpaths(rect(10, 10), 1, 45);
    expect(angled.length).toBeGreaterThan(0);
    // a 45-degree fill of a square is longer than an axis-aligned one
    expect(angled.length).not.toBe(straight.length);
  });

  it('offset (concentric) fill nests inward until empty', async () => {
    const tps = await offsetFillToolpaths(rect(10, 10), 2);
    // 10x10 -> 6x6 -> 2x2 -> empty
    expect(tps).toHaveLength(3);
    expect(tps.every((t) => t.closed)).toBe(true);
  });

  it('generateToolpaths dispatches on mode', async () => {
    const line = await generateToolpaths(rect(10, 10), defaultCutSettings({ mode: 'line' }));
    expect(line).toHaveLength(1);
    const fillLine = await generateToolpaths(
      rect(10, 10),
      defaultCutSettings({ mode: 'fill+line', interval: 2 }),
    );
    expect(fillLine.length).toBe(5 + 1); // fill lines + outline
  });
});
