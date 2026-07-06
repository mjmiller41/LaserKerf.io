import { describe, it } from 'vitest';
import { assertGolden } from 'golden';
import { emitGcodeHeader } from './gcode-header';

describe('gcode header golden', () => {
  it('mm preamble byte-matches the committed fixture', () => {
    const output = emitGcodeHeader({ units: 'mm', feedMmPerMin: 3000, power: 255 });
    assertGolden(new URL('./__golden__/gcode-header.mm.gcode', import.meta.url), output);
  });
});
