import { describe, expect, it, vi } from 'vitest';
import { FakeDevice } from './fake-device';
import type { DeviceStatus, Job } from './types';

const job = (lines: string[]): Job => ({ name: 'test', lines });
const ramp = (n: number): string[] => Array.from({ length: n }, (_, i) => `G1 X${i} Y0`);

describe('FakeDevice — streaming', () => {
  it('streams a job to completion with monotonic progress and bounded buffer', async () => {
    const dev = new FakeDevice({ msPerLine: 0 });
    await dev.connect();

    const seen: DeviceStatus[] = [];
    dev.onStatus((s) => seen.push(s));

    const handle = dev.stream(
      job(['G0 X0 Y0', 'G1 X10 Y0', 'G1 X10 Y10', 'G1 X0 Y10', 'G1 X0 Y0']),
    );
    expect(handle.totalLines).toBe(5);

    const result = await handle.done;
    expect(result).toEqual({ status: 'completed', linesSent: 5 });
    expect(handle.linesSent()).toBe(5);

    const final = dev.status();
    expect(final.state).toBe('idle');
    expect(final.progress).toBe(1);
    expect(final.bufferUsed).toBe(0);
    expect(final.position).toEqual({ x: 0, y: 0, z: 0 });

    const progresses = seen.map((s) => s.progress);
    for (let i = 1; i < progresses.length; i++) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
    }
    for (const s of seen) {
      expect(s.bufferUsed).toBeLessThanOrEqual(final.bufferCapacity);
    }
  });

  it('applies char-counting backpressure to a small RX buffer', async () => {
    const dev = new FakeDevice({ bufferCapacity: 20, msPerLine: 0 });
    await dev.connect();

    let maxBuffer = 0;
    let sawMultipleInFlight = false;
    dev.onStatus((s) => {
      maxBuffer = Math.max(maxBuffer, s.bufferUsed);
      // A single 'G1 Xn Y0' line is ~9-10 bytes; capacity 20 => ~2 lines resident.
      if (s.bufferUsed > 10) sawMultipleInFlight = true;
    });

    const result = await dev.stream(job(ramp(30))).done;
    expect(result.status).toBe('completed');
    expect(result.linesSent).toBe(30);
    expect(maxBuffer).toBeLessThanOrEqual(20);
    expect(sawMultipleInFlight).toBe(true);
  });

  it('honours feed-hold and resume without losing lines', async () => {
    vi.useFakeTimers();
    try {
      const dev = new FakeDevice({ msPerLine: 5 });
      await dev.connect();
      const handle = dev.stream(job(ramp(8)));

      await vi.advanceTimersByTimeAsync(12); // ~2 drains
      const beforeHold = handle.linesSent();
      expect(beforeHold).toBeGreaterThan(0);

      await dev.hold();
      await vi.advanceTimersByTimeAsync(6); // finish the in-flight drain, then park
      const atHold = handle.linesSent();
      expect(dev.status().state).toBe('hold');

      await vi.advanceTimersByTimeAsync(100); // time passes but held => no progress
      expect(handle.linesSent()).toBe(atHold);

      await dev.resume();
      await vi.advanceTimersByTimeAsync(200);
      const result = await handle.done;
      expect(result).toEqual({ status: 'completed', linesSent: 8 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts on stop with a partial, idle result', async () => {
    vi.useFakeTimers();
    try {
      const dev = new FakeDevice({ msPerLine: 5 });
      await dev.connect();
      const handle = dev.stream(job(ramp(20)));

      await vi.advanceTimersByTimeAsync(12);
      expect(handle.linesSent()).toBeGreaterThan(0);
      expect(handle.linesSent()).toBeLessThan(20);

      await dev.stop();
      await vi.advanceTimersByTimeAsync(10);
      const result = await handle.done;

      expect(result.status).toBe('stopped');
      expect(result.linesSent).toBeLessThan(20);
      expect(dev.status().state).toBe('idle');
      expect(dev.status().bufferUsed).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('FakeDevice — motion & guards', () => {
  it('jogs relatively, frames a box, and homes to origin', async () => {
    const dev = new FakeDevice({ msPerLine: 0 });
    await dev.connect();

    await dev.jog({ feed: 1000, delta: { x: 5, y: -2 } });
    expect(dev.status().position).toEqual({ x: 5, y: -2, z: 0 });

    await dev.frame({ min: { x: 0, y: 0 }, max: { x: 10, y: 20 } });
    expect(dev.status().position).toEqual({ x: 0, y: 0, z: 0 }); // back to min corner
    expect(dev.status().state).toBe('idle');

    await dev.home();
    expect(dev.status().position).toEqual({ x: 0, y: 0, z: 0 });
    expect(dev.status().state).toBe('idle');
  });

  it('throws when used disconnected or while already streaming', async () => {
    const dev = new FakeDevice({ msPerLine: 0 });
    expect(() => dev.stream(job(['G0 X0']))).toThrow(/not connected/);

    await dev.connect();
    const handle = dev.stream(job(ramp(50)));
    expect(() => dev.stream(job(['G0 X0']))).toThrow(/already streaming/);
    await handle.done;
  });

  it('reconnect after disconnect resets state', async () => {
    const dev = new FakeDevice({ msPerLine: 0 });
    await dev.connect();
    await dev.disconnect();
    expect(dev.status().state).toBe('disconnected');
    await dev.connect();
    const result = await dev.stream(job(ramp(4))).done;
    expect(result.status).toBe('completed');
  });
});
