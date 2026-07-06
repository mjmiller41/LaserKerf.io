import { describe, it } from 'vitest';
import { assertGolden } from 'golden';
import { createRect, shapeGeometry } from 'scene';
import { defaultCutSettings, fillToolpaths, lineToolpaths } from 'cam';
import { defaultMachine, emitGcode, type GcodeJob } from './gcode';

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

describe('G-code golden output', () => {
  it('rect line + fill matches the committed fixture', () =>
    assertGolden(
      new URL('./__golden__/rect-line-fill.gcode', import.meta.url),
      emitGcode(job, defaultMachine()),
    ));
});
