/**
 * Mesocycle / periodization (spec §2.2, §2.5, §2.13) — pure engine module.
 *
 * A block mesocycle: accumulation (volume ramps up, RPE moderate) → intensification
 * (volume high, RPE climbs, intensifiers unlocked) → a deload week (volume + RPE cut).
 * The functions here are the periodization MATH — they actually change the
 * prescription per week (RPE moves, volume ramps, intensifiers gate). The week
 * counter is a consequence of this, not the feature.
 *
 * ENGINE PURITY: no IO / Date.now / randomness. Week index is passed in; the phase
 * schedule is derived deterministically from totalWeeks.
 */
import type { Muscle, Prescription, PrescribedSet } from './types';

export type Phase = 'accumulation' | 'intensification' | 'deload';

export interface MesocyclePlan {
  totalWeeks: number;
  /** week index (0-based) → phase. Derived from totalWeeks; deterministic. */
  weeks: Phase[];
}

/** Per-muscle weekly volume landmarks (working sets/week): MEV (minimum effective),
 *  MAV (adaptive), MRV (maximum recoverable). Rough evidence-based ranges (§6.4). */
export interface VolumeLandmarks {
  mev: number;
  mav: number;
  mrv: number;
}
const DEFAULT_LANDMARKS: VolumeLandmarks = { mev: 8, mav: 14, mrv: 20 };
const MUSCLE_VOLUME: Partial<Record<Muscle, VolumeLandmarks>> = {
  chest: { mev: 10, mav: 16, mrv: 22 },
  lats: { mev: 10, mav: 16, mrv: 22 },
  middleBack: { mev: 10, mav: 16, mrv: 22 },
  lowerBack: { mev: 6, mav: 10, mrv: 14 },
  shoulders: { mev: 8, mav: 16, mrv: 26 },
  biceps: { mev: 8, mav: 14, mrv: 20 },
  triceps: { mev: 8, mav: 14, mrv: 18 },
  quadriceps: { mev: 8, mav: 14, mrv: 20 },
  hamstrings: { mev: 6, mav: 12, mrv: 16 },
  glutes: { mev: 4, mav: 12, mrv: 16 },
  calves: { mev: 8, mav: 14, mrv: 20 },
  abdominals: { mev: 6, mav: 16, mrv: 25 },
  traps: { mev: 6, mav: 12, mrv: 16 },
  forearms: { mev: 6, mav: 12, mrv: 16 },
};

export const landmarksFor = (m: Muscle): VolumeLandmarks => MUSCLE_VOLUME[m] ?? DEFAULT_LANDMARKS;

/**
 * Build the phase schedule for a mesocycle of `totalWeeks` (clamped 4–12). The last
 * week is always a deload; the rest split ~60% accumulation / ~40% intensification.
 */
export function buildMesocyclePlan(totalWeeks: number): MesocyclePlan {
  const n = Math.max(4, Math.min(12, Math.round(totalWeeks)));
  const work = n - 1; // last week is deload
  const accCount = Math.max(1, Math.round(work * 0.6));
  const weeks: Phase[] = [];
  for (let w = 0; w < n; w++) {
    if (w === n - 1) weeks.push('deload');
    else if (w < accCount) weeks.push('accumulation');
    else weeks.push('intensification');
  }
  return { totalWeeks: n, weeks };
}

export function phaseForWeek(plan: MesocyclePlan, week: number): Phase {
  const w = clampWeek(plan, week);
  return plan.weeks[w]!;
}

const clampWeek = (plan: MesocyclePlan, week: number) =>
  Math.max(0, Math.min(plan.totalWeeks - 1, Math.round(week)));

/** Progress 0..1 through the current phase (first week of a phase = 0). */
function phaseProgress(plan: MesocyclePlan, week: number): number {
  const w = clampWeek(plan, week);
  const phase = plan.weeks[w]!;
  let start = w;
  while (start > 0 && plan.weeks[start - 1] === phase) start--;
  let end = w;
  while (end < plan.totalWeeks - 1 && plan.weeks[end + 1] === phase) end++;
  const span = end - start;
  return span === 0 ? 1 : (w - start) / span;
}

/**
 * The single ramp driver, 0..1: where this week sits on the volume curve. Deload = 0
 * (lowest), accumulation ramps 0.3→0.7, intensification ramps 0.75→1.0. Both the
 * per-muscle volume target and the per-slot set multiplier derive from this so the
 * ramp is defined once.
 */
export function volumeFraction(plan: MesocyclePlan, week: number): number {
  const phase = phaseForWeek(plan, week);
  const p = phaseProgress(plan, week);
  if (phase === 'deload') return 0;
  if (phase === 'accumulation') return 0.3 + p * 0.4; // 0.3 → 0.7
  return 0.75 + p * 0.25; // intensification 0.75 → 1.0
}

/** Target weekly working sets for a muscle this week — lands in [MEV, MRV] and ramps
 *  with volumeFraction; deload pulls back to MEV. (§2.5 + the S12 analytics bands.) */
export function weeklyVolumeTarget(m: Muscle, plan: MesocyclePlan, week: number): number {
  const { mev, mrv } = landmarksFor(m);
  const f = volumeFraction(plan, week);
  return Math.round(mev + f * (mrv - mev));
}

/** Target RPE this week: accumulation 7→8, intensification 8→9, deload 6. (§3.5 setup.) */
export function targetRpeForWeek(plan: MesocyclePlan, week: number): number {
  const phase = phaseForWeek(plan, week);
  const p = phaseProgress(plan, week);
  if (phase === 'deload') return 6;
  const base = phase === 'accumulation' ? 7 : 8;
  return Math.round((base + p) * 2) / 2; // 0.5 granularity, base → base+1
}

/** Per-slot working-set multiplier — ramps with volumeFraction (deload 0.5). */
export function setMultiplier(plan: MesocyclePlan, week: number): number {
  return 0.5 + volumeFraction(plan, week); // deload 0.5 · acc 0.8→1.2 · int 1.25→1.5
}

/** Intensifiers (drop / rest-pause) are unlocked ONLY in the intensification phase. */
export function intensifierForPhase(phase: Phase): 'restPause' | null {
  return phase === 'intensification' ? 'restPause' : null;
}

/**
 * Apply this week's periodization to a base prescription (for double/linear slots;
 * self-periodizing rules like GZCLP carry no mesocycle). Scales the working-set count
 * by the volume ramp, stamps the phase RPE on every working/AMRAP set, and appends a
 * rest-pause intensifier set in the intensification phase only. Weight is untouched —
 * the progression rule owns load.
 */
export function applyPeriodization(
  base: Prescription,
  plan: MesocyclePlan,
  week: number,
): Prescription {
  const phase = phaseForWeek(plan, week);
  const rpe = targetRpeForWeek(plan, week);
  const mult = setMultiplier(plan, week);

  const warmups = base.sets.filter((s) => s.type === 'warmup');
  const working = base.sets.filter((s) => s.type !== 'warmup');
  if (working.length === 0) return base;

  const targetCount = Math.max(1, Math.round(working.length * mult));
  const scaled: PrescribedSet[] = [];
  for (let i = 0; i < targetCount; i++) {
    const src = working[Math.min(i, working.length - 1)]!;
    scaled.push({ ...src, targetRpe: rpe });
  }

  const intensifier = intensifierForPhase(phase);
  if (intensifier) {
    const last = scaled[scaled.length - 1]!;
    scaled.push({
      type: intensifier,
      targetReps: Math.max(1, Math.round(last.targetReps * 0.6)),
      targetWeightLb: last.targetWeightLb,
      targetRpe: 10,
    });
  }

  const phaseLabel = phase[0]!.toUpperCase() + phase.slice(1);
  return {
    sets: [...warmups, ...scaled],
    reason: `${base.reason} · Wk ${clampWeek(plan, week) + 1} ${phaseLabel} (RPE ${rpe})`,
    flags: phase === 'deload' ? [...base.flags, 'deload'] : base.flags,
  };
}
