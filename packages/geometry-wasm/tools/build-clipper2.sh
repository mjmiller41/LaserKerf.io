#!/usr/bin/env bash
#
# From-source build of the Clipper2 C++ -> WASM artifact — the CI-reproducible
# path referenced by the task card's "build reproducible in CI".
#
# M0 ships the prebuilt `clipper2-wasm` npm artifact (see prepare-wasm.mjs); this
# script exists so the binary can be rebuilt from source and diffed. It is gated
# on the Emscripten SDK and is intended to run in a dedicated CI job
# (mymindstorm/setup-emsdk) or locally after `source /path/to/emsdk_env.sh`.
#
# Usage:  pnpm --filter geometry-wasm build:wasm
# Env:    CLIPPER2_WASM_REF  git ref of ErikSom/Clipper2-WASM (default: main)
set -euo pipefail

if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc (Emscripten) is not on PATH." >&2
  echo "  Install the emsdk and 'source emsdk_env.sh', or run" >&2
  echo "  'pnpm --filter geometry-wasm build' to use the prebuilt npm artifact." >&2
  exit 1
fi

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PKG_DIR/wasm-build"           # git-ignored scratch
VENDOR_DIR="$PKG_DIR/vendor"              # tracked output
SRC_DIR="$BUILD_DIR/Clipper2-WASM"
REF="${CLIPPER2_WASM_REF:-main}"

echo "[geometry-wasm] building Clipper2 -> WASM from source (ref: $REF)"
mkdir -p "$BUILD_DIR" "$VENDOR_DIR"

if [ ! -d "$SRC_DIR/.git" ]; then
  git clone --depth 1 --branch "$REF" https://github.com/ErikSom/Clipper2-WASM.git "$SRC_DIR"
fi

# ErikSom/Clipper2-WASM builds via its own CMake project under clipper2-wasm/.
cd "$SRC_DIR/clipper2-wasm"
emcmake cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc 2>/dev/null || echo 4)"

# Collect the emitted glue + wasm next to the package for inspection/diffing
# against the prebuilt npm artifact.
find build -name 'clipper2z*.wasm' -o -name 'clipper2z*.js' | while read -r f; do
  cp "$f" "$VENDOR_DIR/"
done

echo "[geometry-wasm] built Clipper2 WASM into $VENDOR_DIR"
echo "[geometry-wasm] diff against node_modules/clipper2-wasm/dist to verify reproducibility."
