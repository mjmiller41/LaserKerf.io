import { describe, expect, it } from 'vitest';
import { runConformance, type ConformanceVector } from './harness';
import { lineFrameCodec } from './sample-codec';

// Known-good vectors (checksums computed by hand):
//   'G0' -> 0x47 ('G'=71) + 0x30 ('0'=48); sum 119 = 0x77
//   ''   -> empty body; sum 0 = 0x00
const vectors: ConformanceVector<string>[] = [
  { name: 'G0', input: 'G0', expected: new Uint8Array([0x47, 0x30, 0x77]) },
  { name: 'empty', input: '', expected: new Uint8Array([0x00]) },
];

describe('protocol conformance harness', () => {
  it('encodes every vector to its expected bytes', () => {
    const results = runConformance(lineFrameCodec, vectors);
    const failed = results.filter((r) => !r.passed);
    expect(failed.map((f) => f.detail).join('; ')).toBe('');
    expect(failed).toHaveLength(0);
  });
});
