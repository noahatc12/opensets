import { lbToKg } from './units';
import type { WeightUnit } from './units';

/* Plate colours are data. lb bumpers: 45 blue, 35 yellow, 25 green, 10 white, 5 red,
   2.5 grey, 1.25 chrome. kg (IWF): 25 red, 20 blue, 15 yellow, 10 green, 5 white,
   2.5 red, 1.25 chrome. Inventory is stored in lb; a kg user's plates are matched by
   their kg denomination so a 20 kg plate reads blue, not as "44 lb". */

const LB: Array<[number, string, number]> = [
  [45, 'var(--p45)', 26],
  [35, 'var(--p35)', 23],
  [25, 'var(--p25)', 20],
  [10, 'var(--p10)', 16],
  [5, 'var(--p5)', 12],
  [2.5, 'var(--p2)', 9],
  [1.25, 'var(--p1)', 7],
];
const KG: Array<[number, string, number]> = [
  [25, 'var(--p5)', 26],
  [20, 'var(--p45)', 24],
  [15, 'var(--p35)', 21],
  [10, 'var(--p25)', 17],
  [5, 'var(--p10)', 13],
  [2.5, 'var(--p5)', 10],
  [1.25, 'var(--p1)', 8],
  [0.5, 'var(--p2)', 6],
  [0.25, 'var(--p1)', 5],
];

export interface PlateLook {
  /** The denomination in the display unit, e.g. 45 or 20. */
  denom: number;
  color: string;
  /** Mark height in px for the small plate rows. */
  h: number;
}

/** Colour and size for a plate stored in lb, read in the display unit. */
export function plateLook(lb: number, units: WeightUnit): PlateLook {
  const table = units === 'kg' ? KG : LB;
  const v = units === 'kg' ? lbToKg(lb) : lb;
  let best = table[table.length - 1]!;
  let bestGap = Infinity;
  for (const row of table) {
    const gap = Math.abs(row[0] - v);
    if (gap < bestGap) {
      bestGap = gap;
      best = row;
    }
  }
  // A plate that matches nothing standard keeps its real number.
  const denom = bestGap <= 0.15 ? best[0] : Math.round(v * 100) / 100;
  return { denom, color: best[1], h: best[2] };
}

/** "45 + 10" or "45 x 2 + 5" for a per-side breakdown, in the display unit. */
export function plateList(platesLb: number[], units: WeightUnit): string {
  if (platesLb.length === 0) return 'bar only';
  const counts = new Map<number, number>();
  for (const p of [...platesLb].sort((a, b) => b - a)) {
    const d = plateLook(p, units).denom;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([d, n]) => (n > 1 ? `${d} × ${n}` : String(d)))
    .join(' + ');
}
