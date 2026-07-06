import * as Comlink from 'comlink';
import { geometryApi } from './geometry-api';

// Worker entry point: expose the geometry API to the main thread. Because the
// Clipper2 WASM module is only instantiated inside these functions, all heavy
// geometry work runs off the main thread (CLAUDE.md invariant 4).
Comlink.expose(geometryApi);
