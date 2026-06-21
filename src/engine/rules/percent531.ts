/**
 * 5/3/1 (spec §6.2) — TM-based percentage waves over a 4-week cycle.
 *
 * State holds the training max (TM). `cyclePos` is the week index (0–3) of the
 * pending prescription. Called at completion, it advances the wave and returns
 * the next week. After the deload week (W4) the TM increases by `tmIncrementKg`.
 * If the W3 top AMRAP set fails (< 1 rep), the TM resets to 90% of the session's
 * e1RM. Variants add BBB (5×10 @ 50% TM) or FSL (5×5 @ the week's first weight).
 */
import { roundLoad, fmt, workingSets } from './shared';
import { bestSessionE1rm } from '../e1rm';
import type {
  EngineSettings,
  ExerciseState,
  NextPrescriptionResult,
  PrescribedSet,
  PrescriptionFlag,
  ProgressionRule,
  SetResult,
} from '../types';

type Rule = Extract<ProgressionRule, { kind: 'percent531' }>;

interface Wave {
  pcts: [number, number, number];
  reps: [number, number, number];
  amrap: boolean;
}
const WAVES: Wave[] = [
  { pcts: [0.65, 0.75, 0.85], reps: [5, 5, 5], amrap: true }, // W1
  { pcts: [0.7, 0.8, 0.9], reps: [3, 3, 3], amrap: true }, // W2
  { pcts: [0.75, 0.85, 0.95], reps: [5, 3, 1], amrap: true }, // W3
  { pcts: [0.4, 0.5, 0.6], reps: [5, 5, 5], amrap: false }, // W4 deload
];

function buildWave(
  tm: number,
  week: number,
  variant: Rule['variant'],
  settings: EngineSettings,
): PrescribedSet[] {
  const w = WAVES[week]!;
  const sets: PrescribedSet[] = w.pcts.map((p, i) => {
    const amrap = w.amrap && i === 2;
    return {
      type: amrap ? 'amrap' : 'working',
      targetReps: w.reps[i]!,
      targetWeightKg: roundLoad(p * tm, settings),
      ...(amrap ? { amrap: true } : {}),
    };
  });
  // Supplemental volume runs on the work weeks, not the deload.
  if (week !== 3 && variant === 'bbb') {
    const bbb = roundLoad(0.5 * tm, settings);
    for (let i = 0; i < 5; i++)
      sets.push({ type: 'working', targetReps: 10, targetWeightKg: bbb });
  } else if (week !== 3 && variant === 'fsl') {
    const fsl = roundLoad(w.pcts[0] * tm, settings);
    for (let i = 0; i < 5; i++)
      sets.push({ type: 'working', targetReps: 5, targetWeightKg: fsl });
  }
  return sets;
}

export function percent531Next(
  rule: Rule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
): NextPrescriptionResult {
  const tm0 = state.trainingMaxKg ?? state.workingWeightKg;
  const week = ((state.cyclePos % 4) + 4) % 4;
  const work = workingSets(lastSession);
  const flags: PrescriptionFlag[] = [];
  let tm = tm0;
  let targetWeek = week;
  let reason: string;

  if (work.length === 0) {
    reason = `5/3/1 Week ${week + 1} — TM ${fmt(tm)} kg.`;
  } else {
    if (week === 2) {
      const top = work[work.length - 1]!;
      if (!top.completed || top.reps < 1) {
        tm = roundLoad(0.9 * (bestSessionE1rm(work) ?? tm0), settings);
        flags.push('deload');
      }
    } else if (week === 3) {
      tm = tm0 + rule.tmIncrementKg;
      flags.push('tmIncrease');
    }
    targetWeek = (week + 1) % 4;
    reason = flags.includes('tmIncrease')
      ? `New cycle — TM +${fmt(rule.tmIncrementKg)} kg to ${fmt(tm)} kg.`
      : flags.includes('deload')
        ? `Missed the top set — TM reset to ${fmt(tm)} kg (≈90% e1RM).`
        : `5/3/1 Week ${targetWeek + 1} — TM ${fmt(tm)} kg.`;
  }

  return {
    prescription: { sets: buildWave(tm, targetWeek, rule.variant, settings), reason, flags },
    nextState: { ...state, trainingMaxKg: tm, cyclePos: targetWeek, workingWeightKg: tm },
  };
}
