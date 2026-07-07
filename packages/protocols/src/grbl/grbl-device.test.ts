import { describe, expect, it } from 'vitest';
import type { Transport } from 'device-core';
import { GrblDevice } from './grbl-device';
import { REALTIME } from './parse';

const enc = new TextEncoder();
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/**
 * A mock GRBL controller. It receives streamed lines, tracks the bytes resident
 * in its RX buffer (received but not yet acked), records the peak, and lets the
 * test acknowledge lines one at a time or all at once.
 */
class MockGrbl implements Transport {
  readonly kind = 'mock';
  isOpen = false;
  pending: string[] = [];
  realtime: number[] = [];
  peakBytes = 0;
  private buf = '';
  private readonly listeners = new Set<(c: Uint8Array) => void>();

  async open(): Promise<void> {
    this.isOpen = true;
  }
  async close(): Promise<void> {
    this.isOpen = false;
  }
  onData(cb: (c: Uint8Array) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  async write(data: Uint8Array): Promise<void> {
    if (data.length === 1 && [0x3f, 0x21, 0x7e, 0x18].includes(data[0])) {
      this.realtime.push(data[0]);
      if (data[0] === REALTIME.STATUS) this.reply('<Run|MPos:1.000,2.000,0.000>');
      return;
    }
    this.buf += new TextDecoder().decode(data);
    const parts = this.buf.split('\n');
    this.buf = parts.pop() ?? '';
    for (const l of parts) this.pending.push(l);
    this.peakBytes = Math.max(this.peakBytes, this.pendingBytes());
  }
  private pendingBytes(): number {
    return this.pending.reduce((n, l) => n + enc.encode(l).length + 1, 0);
  }
  reply(text: string): void {
    const bytes = enc.encode(`${text}\r\n`);
    for (const cb of this.listeners) cb(bytes);
  }
  ackOne(): void {
    if (this.pending.shift()) this.reply('ok');
  }
  ackAll(): void {
    while (this.pending.length > 0) this.ackOne();
  }
}

async function drain(done: Promise<unknown>, mock: MockGrbl): Promise<void> {
  let settled = false;
  void done.then(() => (settled = true));
  for (let i = 0; i < 500 && !settled; i++) {
    await tick();
    mock.ackAll();
  }
}

describe('GrblDevice streaming (char-counting)', () => {
  it('streams every line and never overflows the RX buffer', async () => {
    const mock = new MockGrbl();
    const dev = new GrblDevice(mock, { bufferSize: 40 });
    await dev.connect();
    const lines = Array.from({ length: 30 }, (_, i) => `G1 X${i}.000 Y0.000`); // > buffer total
    const handle = dev.stream({ lines });
    await drain(handle.done, mock);
    const result = await handle.done;
    expect(result).toEqual({ status: 'completed', linesSent: 30 });
    expect(handle.totalLines).toBe(30);
    // Char-counting held the in-flight bytes within the buffer at all times...
    expect(mock.peakBytes).toBeLessThanOrEqual(40);
    // ...and actually filled it (not a slow one-line-at-a-time trickle).
    expect(mock.peakBytes).toBeGreaterThan(20);
  });

  it('completes an empty job immediately', async () => {
    const mock = new MockGrbl();
    const dev = new GrblDevice(mock);
    await dev.connect();
    const handle = dev.stream({ lines: [] });
    expect(await handle.done).toEqual({ status: 'completed', linesSent: 0 });
  });

  it('faults the job on a GRBL error response', async () => {
    const mock = new MockGrbl();
    const dev = new GrblDevice(mock, { bufferSize: 100 });
    await dev.connect();
    const handle = dev.stream({ lines: ['G1 X1', 'BAD', 'G1 X2'] });
    await tick();
    mock.pending.shift(); // first line accepted
    mock.reply('ok');
    await tick();
    mock.pending.shift(); // second line rejected
    mock.reply('error:20');
    const result = await handle.done;
    expect(result.status).toBe('faulted');
    expect(dev.status().state).toBe('error');
  });

  it('faults on an ALARM during a job', async () => {
    const mock = new MockGrbl();
    const dev = new GrblDevice(mock, { bufferSize: 100 });
    await dev.connect();
    const handle = dev.stream({ lines: ['G1 X1', 'G1 X2'] });
    await tick();
    mock.reply('ALARM:1');
    const result = await handle.done;
    expect(result.status).toBe('faulted');
    expect(dev.status().message).toContain('ALARM:1');
  });

  it('pauses on hold and continues on resume', async () => {
    const mock = new MockGrbl();
    const dev = new GrblDevice(mock, { bufferSize: 20 });
    await dev.connect();
    const lines = Array.from({ length: 10 }, (_, i) => `G1 X${i}`);
    const handle = dev.stream({ lines });
    await tick();
    await dev.hold();
    expect(mock.realtime).toContain(REALTIME.HOLD);
    // Drain what is already in flight; held → no new lines beyond the buffer.
    mock.ackAll();
    await tick();
    const sentWhileHeld = dev.status().progress;
    await tick();
    mock.ackAll();
    expect(dev.status().progress).toBeCloseTo(sentWhileHeld, 5); // no progress while held

    await dev.resume();
    expect(mock.realtime).toContain(REALTIME.RESUME);
    await drain(handle.done, mock);
    expect((await handle.done).status).toBe('completed');
  });

  it('updates position from a status report', async () => {
    const mock = new MockGrbl();
    const dev = new GrblDevice(mock);
    await dev.connect();
    await dev.requestStatus();
    await tick();
    expect(dev.status().position).toEqual({ x: 1, y: 2, z: 0 });
  });

  it('sends a soft-reset and stops the job on stop()', async () => {
    const mock = new MockGrbl();
    const dev = new GrblDevice(mock, { bufferSize: 20 });
    await dev.connect();
    const handle = dev.stream({ lines: Array.from({ length: 10 }, (_, i) => `G1 X${i}`) });
    await tick();
    await dev.stop();
    expect(mock.realtime).toContain(REALTIME.RESET);
    expect((await handle.done).status).toBe('stopped');
  });
});
