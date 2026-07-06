import { describe, expect, it } from 'vitest';
import { createRect, shapeGeometry } from 'scene';
import { defaultCutSettings, fillToolpaths, lineToolpaths } from 'cam';
import { defaultMachine, emitGcode, type GcodeJob } from './gcode';
import { simulate } from './simulate';

const rect = shapeGeometry(createRect(20, 10, { layerId: 'l' }));
const job: GcodeJob = {
  operations: [
    {
      settings: defaultCutSettings({ mode: 'line', speed: 800, maxPower: 60 }),
      toolpaths: lineToolpaths(rect),
    },
    {
      settings: defaultCutSettings({ mode: 'fill', speed: 3000, maxPower: 30, interval: 2 }),
      toolpaths: fillToolpaths(rect, 2, 0),
    },
  ],
};

describe('G-code simulator', () => {
  it('matches emitted order and estimates cut distance/time', () => {
    const sim = simulate(emitGcode(job, defaultMachine()), 6000);
    // outline perimeter 60mm + 5 fill lines * 20mm = 160mm cut
    expect(sim.cutDistance).toBeCloseTo(160, 3);
    // 60mm @ 800mm/min = 4.5s ; 100mm @ 3000mm/min = 2.0s
    expect(sim.cutSeconds).toBeCloseTo(6.5, 2);
    expect(sim.segments.some((s) => s.cut)).toBe(true);
    expect(sim.bounds).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 10 });
  });

  it('classifies rapids as travel, not cut', () => {
    const sim = simulate(emitGcode(job, defaultMachine()), 6000);
    expect(sim.travelDistance).toBeGreaterThan(0);
    expect(sim.segments.some((s) => !s.cut)).toBe(true);
  });
});
