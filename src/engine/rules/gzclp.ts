/**
 * GZCLP (spec §6.2) — per-tier stage machines. Pure.
 *
 * Working increment is a fixed microloading default (2.5 lb ≈ 5 lb); per-lift
 * upper/lower differentiation is a generator concern, not the engine's.
 *
 * - T1 stages 5×3+ → 6×2+ → 10×1+. Hit all reps → +inc, same stage. Miss → next
 *   stage, same weight. Miss stage 3 → recalibrate to ~85% of the session e1RM,
 *   restart stage 1.
 * - T2 stages 3×10 → 3×8 → 3×6, same weight across a stage. Hit → +inc, same
 *   stage. Miss → next stage. Miss 3×6 → restart 3×10 at the last 3×10 weight + inc
 *   (tracked via `anchorLb`).
 * - T3 3×15+. AMRAP final set ≥ 25 reps → +inc, else hold.
 */
import { roundLoad, fmt, workingSets, allHit } from './shared';
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

type Rule = Extract<ProgressionRule, { kind: 'gzclp' }>;

/** GZCLP working increment (lb). The spec's +5 lb default; per-lift upper/lower
 *  differentiation (e.g. +10 lb lower) is the generator's job. */
const INC = 5;

interface StageSpec {
  sets: number;
  reps: number;
}
const T1: StageSpec[] = [
  { sets: 5, reps: 3 },
  { sets: 6, reps: 2 },
  { sets: 10, reps: 1 },
];
const T2: StageSpec[] = [
  { sets: 3, reps: 10 },
  { sets: 3, reps: 8 },
  { sets: 3, reps: 6 },
];
const T3: StageSpec = { sets: 3, reps: 15 };

function buildStage(spec: StageSpec, weightLb: number, amrapLast: boolean): PrescribedSet[] {
  const out: PrescribedSet[] = [];
  for (let i = 0; i < spec.sets; i++) {
    const amrap = amrapLast && i === spec.sets - 1;
    out.push({
      type: amrap ? 'amrap' : 'working',
      targetReps: spec.reps,
      targetWeightLb: weightLb,
      ...(amrap ? { amrap: true } : {}),
    });
  }
  return out;
}

const wrap3 = (n: number) => ((n % 3) + 3) % 3;

export function gzclpNext(
  rule: Rule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
): NextPrescriptionResult {
  const work = workingSets(lastSession);
  if (rule.tier === 3) return tier3(state, work, settings);
  return rule.tier === 1
    ? tier12(state, work, settings, T1, true, 'T1')
    : tier12(state, work, settings, T2, false, 'T2');
}

/** Shared T1/T2 stage machine (they differ only by stage table + AMRAP + the reset). */
function tier12(
  state: ExerciseState,
  work: SetResult[],
  settings: EngineSettings,
  table: StageSpec[],
  amrapLast: boolean,
  label: 'T1' | 'T2',
): NextPrescriptionResult {
  const stage = wrap3(state.stage);
  const flags: PrescriptionFlag[] = [];

  if (work.length === 0) {
    const w = roundLoad(state.workingWeightLb, settings);
    return {
      prescription: {
        sets: buildStage(table[stage]!, w, amrapLast),
        reason: `${label} — starting at ${fmt(w)} lb.`,
        flags,
      },
      nextState: { ...state, workingWeightLb: w, stage, anchorLb: state.anchorLb ?? w },
    };
  }

  const spec = table[stage]!;
  const success = allHit(work, spec.reps);
  let nextStage = stage;
  let nextWeight = state.workingWeightLb;
  let anchor = state.anchorLb ?? state.workingWeightLb;
  let reason: string;

  if (success) {
    nextWeight = state.workingWeightLb + INC;
    if (stage === 0) anchor = nextWeight; // track the 3×10 (or 5×3) weight for the reset
    reason = `+${fmt(INC)} lb — completed ${spec.sets}×${spec.reps}.`;
  } else if (stage < 2) {
    nextStage = stage + 1;
    flags.push('stageChange');
    reason = `Missed — drop to ${table[nextStage]!.sets}×${table[nextStage]!.reps}, same weight.`;
  } else if (label === 'T1') {
    nextWeight = roundLoad(0.85 * (bestSessionE1rm(work) ?? state.workingWeightLb), settings);
    nextStage = 0;
    flags.push('stageChange');
    reason = `${label} stall — recalibrate to ${fmt(roundLoad(nextWeight, settings))} lb (≈85%), restart stage 1.`;
  } else {
    nextWeight = anchor + INC;
    anchor = nextWeight;
    nextStage = 0;
    flags.push('stageChange');
    reason = `${label} stall — restart 3×10 at ${fmt(roundLoad(nextWeight, settings))} lb.`;
  }

  const rw = roundLoad(nextWeight, settings);
  return {
    prescription: { sets: buildStage(table[nextStage]!, rw, amrapLast), reason, flags },
    nextState: { ...state, workingWeightLb: rw, stage: nextStage, anchorLb: anchor },
  };
}

function tier3(
  state: ExerciseState,
  work: SetResult[],
  settings: EngineSettings,
): NextPrescriptionResult {
  if (work.length === 0) {
    const w = roundLoad(state.workingWeightLb, settings);
    return {
      prescription: {
        sets: buildStage(T3, w, true),
        reason: `T3 — starting at ${fmt(w)} lb.`,
        flags: [],
      },
      nextState: { ...state, workingWeightLb: w },
    };
  }
  const amrapSet = work[work.length - 1]!;
  const hit = amrapSet.completed && amrapSet.reps >= 25;
  const nextWeight = hit ? state.workingWeightLb + INC : state.workingWeightLb;
  const rw = roundLoad(nextWeight, settings);
  return {
    prescription: {
      sets: buildStage(T3, rw, true),
      reason: hit
        ? `+${fmt(INC)} lb — ${amrapSet.reps} reps on the AMRAP set (≥ 25).`
        : `Hold ${fmt(rw)} lb — build the AMRAP set toward 25 reps.`,
      flags: [],
    },
    nextState: { ...state, workingWeightLb: rw },
  };
}
