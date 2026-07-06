/**
 * Core value types shared across the device abstraction. Intentionally free of
 * any transport, protocol, or DOM detail — this is the vocabulary UI/CAM speak.
 */

export interface Vec3 {
  x: number;
  y: number;
  /** Optional Z (many laser jobs are 2.5D; Z is undefined when unused). */
  z?: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** Coarse machine state, modelled on GRBL's status but controller-neutral. */
export type MachineState =
  'disconnected' | 'idle' | 'run' | 'hold' | 'jog' | 'home' | 'alarm' | 'error';

export interface DeviceStatus {
  readonly state: MachineState;
  /** Work position in millimetres. */
  readonly position: Vec3;
  /** Fraction of the active job acknowledged, 0..1 (0 when no job). */
  readonly progress: number;
  /** Bytes currently resident in the controller's RX buffer (backpressure). */
  readonly bufferUsed: number;
  readonly bufferCapacity: number;
  /** Free-form controller text (alarm/error detail), when present. */
  readonly message?: string;
}

export interface Job {
  readonly name?: string;
  /** Ordered machine-code lines (e.g. G-code) to stream. */
  readonly lines: readonly string[];
}

export type JobResult =
  | { readonly status: 'completed'; readonly linesSent: number }
  | { readonly status: 'stopped'; readonly linesSent: number }
  | { readonly status: 'faulted'; readonly linesSent: number; readonly error: string };

/** Handle to an in-flight streaming job. */
export interface JobHandle {
  readonly totalLines: number;
  /** Lines acknowledged by the controller so far. */
  linesSent(): number;
  /** Resolves when the job finishes (completed | stopped | faulted). */
  readonly done: Promise<JobResult>;
}

export interface JogOptions {
  /** Feed rate in mm/min. */
  feed: number;
  /** Relative move in millimetres. */
  delta: Vec3;
}

export type StatusListener = (status: DeviceStatus) => void;
