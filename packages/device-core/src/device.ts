import type { Bounds, DeviceStatus, Job, JobHandle, JogOptions, StatusListener } from './types';

/**
 * The device abstraction. **UI and CAM code MUST depend only on this interface**
 * — never on a concrete transport (Web Serial, Agent WSS, …). This is what lets
 * GRBL ship agent-less while Ruida/galvo drop in behind the same surface.
 * (CLAUDE.md invariant 2; development-plan §1.2.)
 */
export interface Device {
  readonly id: string;
  /** Name of the underlying transport ('fake', 'webserial', 'agent'), diagnostics only. */
  readonly transportKind: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** Begin streaming a job. Returns immediately with a handle to track it. */
  stream(job: Job): JobHandle;

  /** Relative jog move. */
  jog(opts: JogOptions): Promise<void>;
  /** Trace the bounding box of a job (framing/outline) at low power. */
  frame(bounds: Bounds, opts?: { feed?: number }): Promise<void>;
  /** Home the machine. */
  home(): Promise<void>;

  /** Feed-hold (pause). Real controllers do this with a real-time byte. */
  hold(): Promise<void>;
  /** Resume from a feed-hold. */
  resume(): Promise<void>;
  /** Abort the active job (soft-reset semantics). */
  stop(): Promise<void>;

  /** Latest status snapshot. */
  status(): DeviceStatus;
  /** Subscribe to status updates; returns an unsubscribe function. */
  onStatus(listener: StatusListener): () => void;
}
