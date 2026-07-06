import { describe, expect, it } from 'vitest';
import { toMachineMm, toMm, type Pt, type Workspace } from './coordinate';

const bed = { widthMm: 400, heightMm: 300 };

describe('coordinate/units matrix', () => {
  it('converts mm and inch to mm', () => {
    expect(toMm(10, 'mm')).toBe(10);
    expect(toMm(1, 'inch')).toBeCloseTo(25.4, 6);
  });

  const cases: Array<{ ws: Workspace; input: Pt; expected: Pt }> = [
    {
      ws: { units: 'mm', origin: 'bottom-left', bed },
      input: { x: 10, y: 20 },
      expected: { x: 10, y: 20 },
    },
    {
      ws: { units: 'mm', origin: 'top-left', bed },
      input: { x: 10, y: 20 },
      expected: { x: 10, y: 280 },
    },
    {
      ws: { units: 'inch', origin: 'bottom-left', bed },
      input: { x: 1, y: 2 },
      expected: { x: 25.4, y: 50.8 },
    },
    {
      ws: { units: 'inch', origin: 'top-left', bed },
      input: { x: 1, y: 2 },
      expected: { x: 25.4, y: 249.2 },
    },
  ];

  for (const c of cases) {
    it(`${c.ws.units} / ${c.ws.origin}`, () => {
      const machine = toMachineMm(c.input, c.ws);
      expect(machine.x).toBeCloseTo(c.expected.x, 6);
      expect(machine.y).toBeCloseTo(c.expected.y, 6);
    });
  }
});
