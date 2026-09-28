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
 * lb rounds to the nearest 0.25, so every real load shows exactly (a 12.5 lb
 * dumbbell, a 47.5 lb bar with 1.25s); it used to round to whole pounds and show
 * weights nobody could load. kg rounds to the nearest 0.5 (plate granularity).
 * Trailing zeros are dropped.
 */
export function fmtWeight(lb: number, unit: WeightUnit): string {
  const v = toUnit(lb, unit);
  const r = unit === 'kg' ? Math.round(v * 2) / 2 : Math.round(v * 4) / 4;
  return String(r);
}

/** A canonical lb weight as an editable number in the display unit: lb to the nearest
 *  0.25 (so 2.5 and 1.25 survive), kg to the nearest 0.5. */
export function displayWeight(lb: number, unit: WeightUnit): number {
  const v = toUnit(lb, unit);
  return unit === 'kg' ? Math.round(v * 2) / 2 : Math.round(v * 4) / 4;
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

// --- Height (stored canonical in inches; entered/shown as ft + in) ---

/** Total inches → { ft, in } for ft/in display. `in` rounds to the nearest inch. */
export const inToFtIn = (inches: number): { ft: number; in: number } => ({
  ft: Math.floor(inches / 12),
  in: Math.round(inches % 12),
});

/** feet + inches → total inches (canonical storage). */
export const ftInToIn = (ft: number, inch: number): number => ft * 12 + inch;

/** What a weight means for a load type, for labels (docs/redesign/NAV.md, rule 7). */
export function loadWord(
  loadType: 'barbell' | 'dumbbell' | 'stack' | 'bodyweight' | undefined,
): string {
  return loadType === 'dumbbell'
    ? 'Per hand'
    : loadType === 'barbell'
      ? 'Total'
      : loadType === 'stack'
        ? 'Stack'
        : loadType === 'bodyweight'
          ? 'Added'
          : 'Weight';
}

/** A weight with what it means: "55 lb per hand", "135 lb", "+25 lb", "BW". */
export function weightWithLoad(
  lb: number,
  unit: WeightUnit,
  loadType: 'barbell' | 'dumbbell' | 'stack' | 'bodyweight' | undefined,
): string {
  if (loadType === 'bodyweight')
    return lb > 0 ? `+${fmtWeight(lb, unit)} ${unit}` : 'BW';
  const w = `${fmtWeight(lb, unit)} ${unit}`;
  return loadType === 'dumbbell' ? `${w} per hand` : w;
}
