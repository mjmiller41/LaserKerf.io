import type { Device } from './device';
import type {
  Bounds,
  DeviceStatus,
  Job,
  JobHandle,
  JobResult,
  JogOptions,
  MachineState,
  StatusListener,
  Vec3,
} from './types';

export interface FakeDeviceOptions {
  id?: string;
  /** Controller RX buffer size in bytes (GRBL's is ~127). Default 127. */
  bufferCapacity?: number;
  /** Simulated time to drain one line from the buffer, in ms. Default 1. */
  msPerLine?: number;
  /**
   * Injectable delay. Defaults to a real setTimeout. Tests pass a controllable
   * clock (or use vitest fake timers with the default) to drive the sim step by
   * step and assert hold/stop behaviour deterministically.
   */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const AXIS = {
  x: /X(-?\d*\.?\d+)/i,
  y: /Y(-?\d*\.?\d+)/i,
  z: /Z(-?\d*\.?\d+)/i,
} as const;

/** Number of bytes a line occupies in the RX buffer (+1 for the newline). */
function byteLength(line: string): number {
  return new TextEncoder().encode(line).length + 1;
}

/** Apply the absolute X/Y/Z of a move line onto a position (G90 assumed). */
function parseMove(line: string, pos: Vec3): Vec3 {
  const next: Vec3 = { x: pos.x, y: pos.y, z: pos.z };
  const mx = line.match(AXIS.x);
  const my = line.match(AXIS.y);
  const mz = line.match(AXIS.z);
  if (mx) next.x = Number(mx[1]);
  if (my) next.y = Number(my[1]);
  if (mz) next.z = Number(mz[1]);
  return next;
}

/**
 * A headless laser simulator implementing the full `Device` interface. It models
 * a bounded RX buffer with char-counting-style backpressure, drains it over
 * simulated time, tracks position, and honours feed-hold/resume/stop — enough to
 * build and test all CAM/UI flows with no hardware (development-plan §4.1).
 *
 * Zero DOM/UI dependencies by construction (verified by running its tests in the
 * 'node' vitest environment).
 */
export class FakeDevice implements Device {
  readonly id: string;
  readonly transportKind = 'fake';

  private readonly capacity: number;
  private readonly msPerLine: number;
  private readonly sleep: (ms: number) => Promise<void>;

  private state: MachineState = 'disconnected';
  private position: Vec3 = { x: 0, y: 0, z: 0 };
  private bufferUsed = 0;
  private total = 0;
  private acked = 0;
  private message: string | undefined;

  private held = false;
  private stopped = false;
  private running = false;
  private resumeWaiters: Array<() => void> = [];

  private readonly listeners = new Set<StatusListener>();

  constructor(opts: FakeDeviceOptions = {}) {
    this.id = opts.id ?? 'fake-0';
    this.capacity = opts.bufferCapacity ?? 127;
    this.msPerLine = opts.msPerLine ?? 1;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  async connect(): Promise<void> {
    if (this.state !== 'disconnected') return;
    this.state = 'idle';
    this.emit();
  }

  async disconnect(): Promise<void> {
    this.stopped = true;
    this.releaseResume();
    this.running = false;
    this.bufferUsed = 0;
    this.state = 'disconnected';
    this.emit();
  }

  status(): DeviceStatus {
    return {
      state: this.state,
      position: { ...this.position },
      progress: this.total === 0 ? 0 : this.acked / this.total,
      bufferUsed: this.bufferUsed,
      bufferCapacity: this.capacity,
      message: this.message,
    };
  }

  onStatus(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  stream(job: Job): JobHandle {
    this.ensureConnected();
    if (this.running) {
      throw new Error('A job is already streaming');
    }
    this.total = job.lines.length;
    this.acked = 0;
    this.bufferUsed = 0;
    this.stopped = false;
    this.held = false;
    this.message = undefined;
    this.running = true;

    const done = this.run(job.lines);
    return {
      totalLines: this.total,
      linesSent: () => this.acked,
      done,
    };
  }

  async jog(opts: JogOptions): Promise<void> {
    this.ensureConnected();
    if (this.running) {
      throw new Error('Cannot jog while a job is streaming');
    }
    this.state = 'jog';
    this.emit();
    await this.sleep(this.msPerLine);
    this.position = {
      x: this.position.x + opts.delta.x,
      y: this.position.y + opts.delta.y,
      z: (this.position.z ?? 0) + (opts.delta.z ?? 0),
    };
    this.state = 'idle';
    this.emit();
  }

  async frame(bounds: Bounds, _opts: { feed?: number } = {}): Promise<void> {
    this.ensureConnected();
    if (this.running) {
      throw new Error('Cannot frame while a job is streaming');
    }
    this.state = 'run';
    this.emit();
    const { min, max } = bounds;
    const corners: Vec3[] = [
      { x: min.x, y: min.y },
      { x: max.x, y: min.y },
      { x: max.x, y: max.y },
      { x: min.x, y: max.y },
      { x: min.x, y: min.y },
    ];
    for (const corner of corners) {
      await this.sleep(this.msPerLine);
      this.position = { x: corner.x, y: corner.y, z: this.position.z };
      this.emit();
    }
    this.state = 'idle';
    this.emit();
  }

  async home(): Promise<void> {
    this.ensureConnected();
    if (this.running) {
      throw new Error('Cannot home while a job is streaming');
    }
    this.state = 'home';
    this.emit();
    await this.sleep(this.msPerLine);
    this.position = { x: 0, y: 0, z: 0 };
    this.state = 'idle';
    this.emit();
  }

  async hold(): Promise<void> {
    if (!this.running) return;
    // Takes effect at the run loop's next checkpoint (like a real feed-hold).
    this.held = true;
  }

  async resume(): Promise<void> {
    if (!this.held) return;
    this.held = false;
    this.state = 'run';
    this.releaseResume();
    this.emit();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.held = false;
    this.releaseResume();
  }

  // ---- internals ----

  private async run(lines: readonly string[]): Promise<JobResult> {
    this.state = 'run';
    this.emit();

    const inFlight: Array<{ bytes: number; line: string }> = [];
    let cursor = 0;

    try {
      for (;;) {
        if (this.stopped) return this.finish('stopped');

        if (this.held) {
          this.state = 'hold';
          this.emit();
          await this.waitResume();
          if (this.stopped) return this.finish('stopped');
          this.state = 'run';
          this.emit();
          continue;
        }

        // Fill the RX buffer as far as it fits (char-counting backpressure).
        // A single line is always admitted even if larger than the buffer, so a
        // pathologically small capacity can never deadlock.
        while (cursor < lines.length) {
          const line = lines[cursor];
          const bytes = byteLength(line);
          if (inFlight.length > 0 && this.bufferUsed + bytes > this.capacity) break;
          inFlight.push({ bytes, line });
          this.bufferUsed += bytes;
          cursor++;
        }
        this.emit();

        if (inFlight.length === 0) break; // nothing queued and nothing in flight

        // Drain the oldest line after one simulated line-time.
        await this.sleep(this.msPerLine);
        if (this.stopped) return this.finish('stopped');
        const head = inFlight.shift();
        if (!head) continue;
        this.bufferUsed -= head.bytes;
        this.position = parseMove(head.line, this.position);
        this.acked++;
        this.emit();
      }
      return this.finish('completed');
    } catch (err) {
      this.running = false;
      this.state = 'error';
      this.message = err instanceof Error ? err.message : String(err);
      this.emit();
      return { status: 'faulted', linesSent: this.acked, error: this.message };
    }
  }

  private finish(status: 'completed' | 'stopped'): JobResult {
    this.running = false;
    this.bufferUsed = 0;
    this.state = 'idle';
    this.emit();
    return { status, linesSent: this.acked };
  }

  private waitResume(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resumeWaiters.push(resolve);
    });
  }

  private releaseResume(): void {
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    for (const resolve of waiters) resolve();
  }

  private ensureConnected(): void {
    if (this.state === 'disconnected') {
      throw new Error('Device is not connected');
    }
  }

  private emit(): void {
    const snapshot = this.status();
    for (const listener of this.listeners) listener(snapshot);
  }
}
