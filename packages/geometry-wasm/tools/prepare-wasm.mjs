// `pnpm --filter geometry-wasm build` entry point.
//
// The default build consumes the prebuilt Clipper2 WASM artifact shipped by the
// `clipper2-wasm` npm package (this is the path chosen for M0 — see the task
// card). This script verifies that artifact resolves and is non-empty so a
// broken/absent binary fails the build loudly rather than at runtime.
//
// The from-source, CI-reproducible build (Emscripten) is `build:wasm`
// (tools/build-clipper2.sh).

import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

function resolvePrebuiltWasm() {
  const pkgRoot = dirname(require.resolve('clipper2-wasm/package.json'));
  return join(pkgRoot, 'dist', 'es', 'clipper2z.wasm');
}

try {
  const wasmPath = resolvePrebuiltWasm();
  const { size } = statSync(wasmPath);
  if (size <= 0) {
    console.error(`[geometry-wasm] prebuilt Clipper2 WASM is empty: ${wasmPath}`);
    process.exit(1);
  }
  console.log(`[geometry-wasm] prebuilt Clipper2 WASM OK: ${wasmPath} (${size} bytes)`);
} catch (err) {
  console.error('[geometry-wasm] could not resolve the prebuilt Clipper2 WASM artifact.');
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
