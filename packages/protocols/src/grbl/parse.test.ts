import { describe, expect, it } from 'vitest';
import { parseResponse, REALTIME, splitLines } from './parse';

describe('parseResponse', () => {
  it('parses ok / error / alarm', () => {
    expect(parseResponse('ok')).toEqual({ type: 'ok' });
    expect(parseResponse('error:20')).toEqual({ type: 'error', code: 20 });
    expect(parseResponse('ALARM:1')).toEqual({ type: 'alarm', code: 1 });
    expect(parseResponse('  ')).toBeNull();
  });

  it('parses a status report into state + positions', () => {
    const r = parseResponse('<Run|MPos:1.000,2.000,3.000|WPos:0.500,0.250,0.000|FS:500,0>');
    expect(r).toMatchObject({ type: 'status', state: 'run' });
    if (r?.type === 'status') {
      expect(r.mpos).toEqual({ x: 1, y: 2, z: 3 });
      expect(r.wpos).toEqual({ x: 0.5, y: 0.25, z: 0 });
    }
  });

  it('maps Hold:0 and Door to the hold state', () => {
    expect(parseResponse('<Hold:0|MPos:0,0,0>')).toMatchObject({ state: 'hold' });
    expect(parseResponse('<Door:1|MPos:0,0,0>')).toMatchObject({ state: 'hold' });
  });

  it('parses the welcome banner', () => {
    expect(parseResponse('Grbl 1.1f [\'$\' for help]')).toEqual({ type: 'welcome', version: '1.1f' });
  });

  it('exposes real-time byte values', () => {
    expect([REALTIME.STATUS, REALTIME.HOLD, REALTIME.RESUME, REALTIME.RESET]).toEqual([
      0x3f, 0x21, 0x7e, 0x18,
    ]);
  });
});

describe('splitLines', () => {
  it('splits on CRLF/LF and keeps the partial tail', () => {
    expect(splitLines('ok\r\nerror:1\nok')).toEqual({ lines: ['ok', 'error:1'], rest: 'ok' });
  });
});
