import type { Codec } from './harness';

/**
 * Placeholder framing codec: UTF-8 bytes of a line plus a trailing mod-256
 * checksum. Stands in for a real protocol codec (Ruida's 2-byte checksum, GRBL
 * line framing, …) purely so the conformance harness has something to exercise.
 */
export const lineFrameCodec: Codec<string> = {
  name: 'line-frame',
  encode(line) {
    const body = new TextEncoder().encode(line);
    let sum = 0;
    for (const b of body) sum = (sum + b) & 0xff;
    const out = new Uint8Array(body.length + 1);
    out.set(body, 0);
    out[body.length] = sum;
    return out;
  },
};
