/**
 * Protocol conformance harness (development-plan §4.5, §8). Each controller
 * codec is validated by running its encoder over vectors and asserting the bytes
 * match captured/emulator output. The GRBL/Ruida/galvo codecs (M2/M4/M7) plug a
 * `Codec` in here; M0 ships the harness + a placeholder codec so it is proven.
 */

export interface Codec<I> {
  readonly name: string;
  encode(input: I): Uint8Array;
}

export interface ConformanceVector<I> {
  readonly name: string;
  readonly input: I;
  readonly expected: Uint8Array;
}

export interface ConformanceResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function runConformance<I>(
  codec: Codec<I>,
  vectors: readonly ConformanceVector<I>[],
): ConformanceResult[] {
  return vectors.map((v) => {
    const actual = codec.encode(v.input);
    if (bytesEqual(actual, v.expected)) {
      return { name: `${codec.name}: ${v.name}`, passed: true };
    }
    return {
      name: `${codec.name}: ${v.name}`,
      passed: false,
      detail: `expected [${hex(v.expected)}], got [${hex(actual)}]`,
    };
  });
}
