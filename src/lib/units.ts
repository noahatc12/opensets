/**
 * Weight-unit display helpers. lb is the canonical stored unit (spec §6, §8 —
 * pounds-first); kg is a display-only conversion. Everything the user sees as a
 * weight must go through here so the lb/kg setting is consistent across the app.
 * Metric is used ONLY inside the BMR / protein formulas, converted at that boundary.
 */
export const KG_PER_LB = 0.45359237;

export type WeightUnit = 'kg' | 'lb';

export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;

/** Canonical lb → a number in the display unit (no rounding). */
export const toUnit = (lb: number, unit: WeightUnit): number =>
  unit === 'kg' ? lbToKg(lb) : lb;

/** Short unit label for the current setting. */
export const unitLabel = (unit: WeightUnit): WeightUnit => unit;

/**
 * Format a canonical lb weight for display in the user's unit.
 * lb rounds to the nearest 1 (pounds read clean as whole numbers); kg rounds to
 * the nearest 0.5 (plate granularity). Trailing ".0" is dropped.
 */
export function fmtWeight(lb: number, unit: WeightUnit): string {
  const v = toUnit(lb, unit);
  const r = unit === 'kg' ? Math.round(v * 2) / 2 : Math.round(v);
  return Number.isInteger(r) ? String(r) : String(r);
}

/** Round a converted value to a tidy display precision (for e1RM etc.). */
export function roundDisplay(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? Math.round(value * 10) / 10 : Math.round(value);
}

/**
 * Manual weight-stepper increment, in canonical lb, for the unit:
 * 5 lb in lb mode, 2.5 kg (stored as its lb equivalent) in kg mode — so a kg user
 * steps by round kilograms while storage stays canonical pounds.
 */
export const weightStepLb = (unit: WeightUnit): number =>
  unit === 'kg' ? kgToLb(2.5) : 5;

/** Label for the stepper increment in the current unit. */
export const weightStepLabel = (unit: WeightUnit): string =>
  unit === 'kg' ? '2.5 kg' : '5 lb';
