export type CutMode = 'line' | 'fill' | 'offset-fill' | 'fill+line';
export type FillGrouping = 'all-at-once' | 'groups' | 'individually';

/** Per-layer cut settings (M2-T02). Power is a percentage; speed is mm/min. */
export interface CutSettings {
  mode: CutMode;
  speed: number;
  /** Min/max power (%). Min feeds power-ramping (rubber-stamp) and grayscale (M6). */
  minPower: number;
  maxPower: number;
  passes: number;
  /** Fill line spacing (mm). */
  interval: number;
  /** Fill scan angle (degrees). */
  angle: number;
  airAssist: boolean;
  /** How fill lines are ordered across sub-shapes. */
  fillGrouping: FillGrouping;
}

export function defaultCutSettings(over: Partial<CutSettings> = {}): CutSettings {
  return {
    mode: 'line',
    speed: 1000,
    minPower: 15,
    maxPower: 80,
    passes: 1,
    interval: 0.1,
    angle: 0,
    airAssist: false,
    fillGrouping: 'all-at-once',
    ...over,
  };
}
