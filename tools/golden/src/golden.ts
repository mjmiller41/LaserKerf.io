/// <reference types="node" />
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Golden-output harness (development-plan §4.3, §8): the single most important
 * CAM guardrail. Given design X + settings Y, the emitted machine code must
 * byte-match (or tolerance-match) a committed fixture. This is how silent CAM
 * regressions are prevented.
 *
 * CLAUDE.md: never change a golden fixture without noting it in the commit body.
 * Set UPDATE_GOLDEN=1 to (re)write fixtures deliberately.
 */

export interface GoldenOptions {
  /** Rewrite the fixture instead of asserting (also honoured via UPDATE_GOLDEN=1). */
  update?: boolean;
}

function toBytes(actual: Uint8Array | string): Uint8Array {
  return typeof actual === 'string' ? new TextEncoder().encode(actual) : actual;
}

function resolveFixture(fixture: string | URL): string {
  if (typeof fixture === 'string') {
    return fixture.startsWith('file:') ? fileURLToPath(fixture) : fixture;
  }
  return fileURLToPath(fixture);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function mismatchMessage(path: string, actual: Uint8Array, expected: Uint8Array): string {
  const decoder = new TextDecoder();
  return [
    `Golden mismatch: ${path}`,
    `  expected ${expected.length} bytes, got ${actual.length} bytes`,
    `  --- expected (first 300 chars) ---`,
    decoder.decode(expected).slice(0, 300),
    `  --- actual (first 300 chars) ---`,
    decoder.decode(actual).slice(0, 300),
    `  If this change is intentional: re-run with UPDATE_GOLDEN=1 and note it in the commit body.`,
  ].join('\n');
}

/**
 * Assert `actual` byte-matches the fixture. Accepts a path or a file: URL (pass
 * `new URL('./__golden__/x', import.meta.url)` from a test). Throws on mismatch.
 */
export function assertGolden(
  fixture: string | URL,
  actual: Uint8Array | string,
  opts: GoldenOptions = {},
): void {
  const path = resolveFixture(fixture);
  const bytes = toBytes(actual);
  const update = opts.update ?? process.env.UPDATE_GOLDEN === '1';

  if (update || !existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    if (!update) {
      throw new Error(
        `Golden fixture did not exist and was created: ${path}\n` +
          `Re-run to verify. New fixtures must be noted in the commit body.`,
      );
    }
    return;
  }

  const expected = new Uint8Array(readFileSync(path));
  if (!bytesEqual(bytes, expected)) {
    throw new Error(mismatchMessage(path, bytes, expected));
  }
}
