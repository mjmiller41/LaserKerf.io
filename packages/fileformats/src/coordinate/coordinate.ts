/**
 * Coordinate / units harness (development-plan §4.6). A class of bugs — mm vs
 * inch, job origin vs machine origin, workspace transforms — erodes trust fast,
 * so the transform lives behind one tested function from day one. M2/M9 expand
 * this (center origin, mirroring, negative workspaces); M0 nails units + Y-origin.
 */
export type Units = 'mm' | 'inch';
export type Origin = 'bottom-left' | 'top-left';

export interface Bed {
  widthMm: number;
  heightMm: number;
}

export interface Workspace {
  units: Units;
  origin: Origin;
  bed: Bed;
}

export interface Pt {
  x: number;
  y: number;
}

export const MM_PER_INCH = 25.4;

export function toMm(value: number, units: Units): number {
  return units === 'inch' ? value * MM_PER_INCH : value;
}

/**
 * Transform a design-space point (in `ws.units`, with Y measured from `ws.origin`)
 * to machine millimetres in GRBL's bottom-left, Y-up convention.
 */
export function toMachineMm(p: Pt, ws: Workspace): Pt {
  const x = toMm(p.x, ws.units);
  const y = toMm(p.y, ws.units);
  return ws.origin === 'top-left' ? { x, y: ws.bed.heightMm - y } : { x, y };
}
