import { describe, it } from 'vitest';
import { assertGolden } from 'golden';
import { createRect, shapeGeometry } from 'scene';
import { fillToolpaths, lineToolpaths, serializeToolpaths } from './toolpath';

const rect = (w: number, h: number) => shapeGeometry(createRect(w, h, { layerId: 'l' }));
const golden = (name: string): URL => new URL(`./__golden__/${name}.txt`, import.meta.url);

describe('toolpath golden geometry', () => {
  it('line mode outline', () =>
    assertGolden(golden('line-rect'), serializeToolpaths(lineToolpaths(rect(20, 10)))));

  it('fill mode, 0 degrees', () =>
    assertGolden(golden('fill-rect-0'), serializeToolpaths(fillToolpaths(rect(20, 10), 2, 0))));

  it('fill mode, 45 degrees', () =>
    assertGolden(golden('fill-rect-45'), serializeToolpaths(fillToolpaths(rect(20, 10), 2, 45))));
});
