/**
 * fileformats — project storage today (OPFS + IndexedDB + autosave); the
 * `.fluence` format, `.lbrn` import, and SVG/DXF/AI/PDF + G-code/.rd codecs land
 * in M1/M2/M4. The golden-output harness for machine code also lives here
 * (`pnpm --filter fileformats test:golden`).
 */
export * from './storage/index';
export * from './coordinate/coordinate';
export {
  deserializeFluence,
  FLUENCE_FORMAT_VERSION,
  serializeFluence,
  type LoadedFluence,
} from './fluence/fluence';
export {
  defaultMachine,
  emitGcode,
  type GcodeJob,
  type GcodeOperation,
  type MachineConfig,
} from './gcode/gcode';
export { simulate, type Simulation, type SimSegment } from './gcode/simulate';
