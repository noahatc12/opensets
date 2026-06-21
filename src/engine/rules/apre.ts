/**
 * APRE 3/6/10 (spec §6.2) — Autoregulating Progressive Resistance Exercise. Pure.
 *
 * Four sets: warm-ups at 50% / 75% of the working RM, then an AMRAP at the RM. The
 * reps achieved on the AMRAP set drive next session's RM via a lookup table
 * (published lb tables mapped to lb deltas). The 4th set repeats the (adjusted) RM.
 */
import { roundLoad, fmt, workingSets } from './shared';
import type {
  EngineSettings,
  ExerciseState,
  NextPrescriptionResult,
  PrescribedSet,
  ProgressionRule,
  SetResult,
} from '../types';

type Rule = Extract<ProgressionRule, { kind: 'apre' }>;

interface RmSpec {
  warmReps: [number, number];
  deltas: { max: number; lb: number }[];
}
// Native APRE lb tables (Mann/Bryan), set-3 (RM AMRAP) reps → next-session adjustment.
// Single clean-lb values across the published ranges (−5..10 / +5..10 / +10..15).
const APRE: Record<3 | 6 | 10, RmSpec> = {
  10: {
    warmReps: [10, 6],
    deltas: [
      { max: 6, lb: -10 },
      { max: 8, lb: -5 },
      { max: 11, lb: 0 },
      { max: 16, lb: 5 },
      { max: Infinity, lb: 10 },
    ],
  },
  6: {
    warmReps: [6, 4],
    deltas: [
      { max: 2, lb: -10 },
      { max: 4, lb: -5 },
      { max: 7, lb: 0 },
      { max: 12, lb: 5 },
      { max: Infinity, lb: 10 },
    ],
  },
  3: {
    warmReps: [3, 2],
    deltas: [
      { max: 2, lb: -10 },
      { max: 4, lb: 0 },
      { max: 6, lb: 5 },
      { max: Infinity, lb: 10 },
    ],
  },
};

function deltaFor(rm: 3 | 6 | 10, reps: number): number {
  return APRE[rm].deltas.find((b) => reps <= b.max)!.lb;
}

export function apreNext(
  rule: Rule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
): NextPrescriptionResult {
  const rm = rule.rm;
  const work = workingSets(lastSession);
  let rmWeight = state.workingWeightLb;
  let reason: string;

  if (work.length === 0) {
    reason = `APRE-${rm} — calibrate your ${rm}RM.`;
  } else {
    const amrapSet = work.find((s) => s.type === 'amrap') ?? work[work.length - 1]!;
    const reps = amrapSet.completed ? amrapSet.reps : 0;
    const delta = deltaFor(rm, reps);
    rmWeight = state.workingWeightLb + delta;
    reason =
      delta > 0
        ? `+${fmt(delta)} lb — ${reps} reps on the AMRAP set.`
        : delta < 0
          ? `−${fmt(-delta)} lb — ${reps} reps on the AMRAP set.`
          : `Hold the RM — ${reps} reps in the target band.`;
  }

  const rmW = roundLoad(rmWeight, settings);
  const spec = APRE[rm];
  const sets: PrescribedSet[] = [
    { type: 'working', targetReps: spec.warmReps[0], targetWeightLb: roundLoad(0.5 * rmW, settings) },
    { type: 'working', targetReps: spec.warmReps[1], targetWeightLb: roundLoad(0.75 * rmW, settings) },
    { type: 'amrap', targetReps: rm, targetWeightLb: rmW, amrap: true },
    { type: 'amrap', targetReps: rm, targetWeightLb: rmW, amrap: true },
  ];

  return {
    prescription: { sets, reason, flags: [] },
    nextState: { ...state, workingWeightLb: rmW },
  };
}
