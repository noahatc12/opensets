/**
 * APRE 3/6/10 (spec §6.2) — Autoregulating Progressive Resistance Exercise. Pure.
 *
 * Four sets: warm-ups at 50% / 75% of the working RM, then an AMRAP at the RM. The
 * reps achieved on the AMRAP set drive next session's RM via a lookup table
 * (published lb tables mapped to kg deltas). The 4th set repeats the (adjusted) RM.
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
  deltas: { max: number; kg: number }[];
}
const APRE: Record<3 | 6 | 10, RmSpec> = {
  10: {
    warmReps: [10, 6],
    deltas: [
      { max: 6, kg: -5 },
      { max: 8, kg: -2.5 },
      { max: 11, kg: 0 },
      { max: 16, kg: 5 },
      { max: Infinity, kg: 7.5 },
    ],
  },
  6: {
    warmReps: [6, 4],
    deltas: [
      { max: 2, kg: -5 },
      { max: 4, kg: -2.5 },
      { max: 7, kg: 0 },
      { max: 12, kg: 5 },
      { max: Infinity, kg: 7.5 },
    ],
  },
  3: {
    warmReps: [3, 2],
    deltas: [
      { max: 2, kg: -5 },
      { max: 4, kg: 0 },
      { max: 6, kg: 5 },
      { max: Infinity, kg: 7.5 },
    ],
  },
};

function deltaFor(rm: 3 | 6 | 10, reps: number): number {
  return APRE[rm].deltas.find((b) => reps <= b.max)!.kg;
}

export function apreNext(
  rule: Rule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
): NextPrescriptionResult {
  const rm = rule.rm;
  const work = workingSets(lastSession);
  let rmWeight = state.workingWeightKg;
  let reason: string;

  if (work.length === 0) {
    reason = `APRE-${rm} — calibrate your ${rm}RM.`;
  } else {
    const amrapSet = work.find((s) => s.type === 'amrap') ?? work[work.length - 1]!;
    const reps = amrapSet.completed ? amrapSet.reps : 0;
    const delta = deltaFor(rm, reps);
    rmWeight = state.workingWeightKg + delta;
    reason =
      delta > 0
        ? `+${fmt(delta)} kg — ${reps} reps on the AMRAP set.`
        : delta < 0
          ? `−${fmt(-delta)} kg — ${reps} reps on the AMRAP set.`
          : `Hold the RM — ${reps} reps in the target band.`;
  }

  const rmW = roundLoad(rmWeight, settings);
  const spec = APRE[rm];
  const sets: PrescribedSet[] = [
    { type: 'working', targetReps: spec.warmReps[0], targetWeightKg: roundLoad(0.5 * rmW, settings) },
    { type: 'working', targetReps: spec.warmReps[1], targetWeightKg: roundLoad(0.75 * rmW, settings) },
    { type: 'amrap', targetReps: rm, targetWeightKg: rmW, amrap: true },
    { type: 'amrap', targetReps: rm, targetWeightKg: rmW, amrap: true },
  ];

  return {
    prescription: { sets, reason, flags: [] },
    nextState: { ...state, workingWeightKg: rmW },
  };
}
