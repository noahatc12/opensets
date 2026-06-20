/**
 * Weight-unit display helpers. kg is the canonical stored unit (spec §1); lb is
 * a display-only conversion. Everything the user sees as a weight must go through
 * here so the kg/lb setting is consistent across the whole app.
 */
export const KG_PER_LB = 0.45359237;

export type WeightUnit = 'kg' | 'lb';

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

/** Canonical kg → a number in the display unit (no rounding). */
export const toUnit = (kg: number, unit: WeightUnit): number =>
  unit === 'lb' ? kgToLb(kg) : kg;

/** Short unit label for the current setting. */
export const unitLabel = (unit: WeightUnit): WeightUnit => unit;

/**
 * Format a canonical kg weight for display in the user's unit.
 * kg rounds to the nearest 0.5 (plate granularity); lb rounds to the nearest 1
 * (pounds read clean as whole numbers). Trailing ".0" is dropped.
 */
export function fmtWeight(kg: number, unit: WeightUnit): string {
  const v = toUnit(kg, unit);
  const r = unit === 'lb' ? Math.round(v) : Math.round(v * 2) / 2;
  return Number.isInteger(r) ? String(r) : String(r);
}

/** Round a converted value to a tidy display precision (for e1RM etc.). */
export function roundDisplay(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? Math.round(value) : Math.round(value * 10) / 10;
}

/**
 * Manual weight-stepper increment, in canonical kg, for the unit:
 * 2.5 kg in kg mode, 5 lb (stored as its kg equivalent) in lb mode — so a lb
 * user steps by round pounds while storage stays canonical.
 */
export const weightStepKg = (unit: WeightUnit): number =>
  unit === 'lb' ? lbToKg(5) : 2.5;

/** Label for the stepper increment in the current unit. */
export const weightStepLabel = (unit: WeightUnit): string =>
  unit === 'lb' ? '5 lb' : '2.5 kg';
