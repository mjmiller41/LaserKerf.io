import type { Vec2 } from 'scene';

export interface SimSegment {
  from: Vec2;
  to: Vec2;
  /** true = laser-on cutting move; false = rapid travel. */
  cut: boolean;
}

export interface Simulation {
  segments: SimSegment[];
  cutDistance: number;
  travelDistance: number;
  cutSeconds: number;
  travelSeconds: number;
  totalSeconds: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

/**
 * Simulate emitted G-code: replays motion in order, classifying each move as a
 * cut (G1 with the laser on) or a rapid, and estimates time from feed rates. The
 * segment list is in exact emission order, so it doubles as the preview path.
 */
export function simulate(gcode: string, travelSpeed = 6000): Simulation {
  let x = 0;
  let y = 0;
  let feed = 1000;
  let laserOn = false;
  let mode: 0 | 1 = 0;

  const segments: SimSegment[] = [];
  let cutDistance = 0;
  let travelDistance = 0;
  let cutSeconds = 0;
  let travelSeconds = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const raw of gcode.split('\n')) {
    const line = raw.split(';')[0].trim();
    if (!line) continue;

    let nx = x;
    let ny = y;
    let hasMove = false;
    let motion: 0 | 1 | null = null;

    for (const tok of line.split(/\s+/)) {
      const letter = tok[0]?.toUpperCase();
      const val = Number(tok.slice(1));
      if (letter === 'G') {
        if (val === 0) motion = 0;
        else if (val === 1) motion = 1;
      } else if (letter === 'X' && !Number.isNaN(val)) {
        nx = val;
        hasMove = true;
      } else if (letter === 'Y' && !Number.isNaN(val)) {
        ny = val;
        hasMove = true;
      } else if (letter === 'F' && !Number.isNaN(val)) {
        feed = val;
      } else if (letter === 'M') {
        if (val === 3 || val === 4) laserOn = true;
        else if (val === 5) laserOn = false;
      }
    }
    if (motion !== null) mode = motion;

    if (hasMove) {
      const d = Math.hypot(nx - x, ny - y);
      const cut = mode === 1 && laserOn;
      segments.push({ from: { x, y }, to: { x: nx, y: ny }, cut });
      const speed = cut ? feed : travelSpeed;
      const seconds = speed > 0 ? (d / speed) * 60 : 0;
      if (cut) {
        cutDistance += d;
        cutSeconds += seconds;
        minX = Math.min(minX, x, nx);
        minY = Math.min(minY, y, ny);
        maxX = Math.max(maxX, x, nx);
        maxY = Math.max(maxY, y, ny);
      } else {
        travelDistance += d;
        travelSeconds += seconds;
      }
      x = nx;
      y = ny;
    }
  }

  return {
    segments,
    cutDistance,
    travelDistance,
    cutSeconds,
    travelSeconds,
    totalSeconds: cutSeconds + travelSeconds,
    bounds: minX === Infinity ? null : { minX, minY, maxX, maxY },
  };
}
