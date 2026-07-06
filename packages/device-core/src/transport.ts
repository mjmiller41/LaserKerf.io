/**
 * Transport layer. A `Transport` is a raw bidirectional byte pipe; concrete
 * implementations (WebSerialTransport for GRBL, AgentTransport for Ruida/galvo)
 * land in M3/M4 and self-register into a `TransportRegistry`. Devices are built
 * on top of a transport but the `Device` interface never leaks which one.
 */

export interface Transport {
  readonly kind: string;
  readonly isOpen: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  /** Subscribe to inbound bytes; returns an unsubscribe function. */
  onData(cb: (chunk: Uint8Array) => void): () => void;
}

export type TransportFactory = (config?: unknown) => Transport | Promise<Transport>;

/** A pluggable registry of transport factories keyed by kind. */
export class TransportRegistry {
  private readonly factories = new Map<string, TransportFactory>();

  register(kind: string, factory: TransportFactory): void {
    if (this.factories.has(kind)) {
      throw new Error(`Transport "${kind}" is already registered`);
    }
    this.factories.set(kind, factory);
  }

  has(kind: string): boolean {
    return this.factories.has(kind);
  }

  kinds(): string[] {
    return [...this.factories.keys()];
  }

  async create(kind: string, config?: unknown): Promise<Transport> {
    const factory = this.factories.get(kind);
    if (!factory) {
      throw new Error(`No transport registered for "${kind}"`);
    }
    return factory(config);
  }
}

/** Process-wide default registry. Real transports self-register here on import. */
export const transports = new TransportRegistry();

/**
 * A trivial in-memory loopback transport: bytes written are echoed straight back
 * to readers. Useful for exercising the registry/transport seam in headless
 * tests without any hardware.
 */
export class LoopbackTransport implements Transport {
  readonly kind = 'loopback';
  private open_ = false;
  private readonly listeners = new Set<(chunk: Uint8Array) => void>();

  get isOpen(): boolean {
    return this.open_;
  }

  async open(): Promise<void> {
    this.open_ = true;
  }

  async close(): Promise<void> {
    this.open_ = false;
    this.listeners.clear();
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.open_) {
      throw new Error('Transport is not open');
    }
    for (const cb of this.listeners) {
      cb(data);
    }
  }

  onData(cb: (chunk: Uint8Array) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
