/**
 * Personal-record detection (spec §5 P1). Pure.
 *
 * Three kinds, judged against an exercise's prior completed sets:
 *  - weight: heaviest load ever (loaded lifts only)
 *  - reps:   most reps ever at this exact weight (covers bodyweight rep PRs)
 *  - e1rm:   highest estimated 1RM ever (eligible sets only, §6.3)
 *
 * The first-ever set sets no PRs (nothing to beat) so a first session doesn't
 * celebrate every set. Ties are not PRs (strictly greater).
 */
import { e1rm, isE1rmEligible } from './e1rm';
import type { PRKind, SetResult } from './types';

export interface PRResult {
  kinds: PRKind[];
  /** The candidate's e1RM if eligible, else null (handy for the UI/celebration). */
  e1rm: number | null;
}

export function detectPRs(
  candidate: SetResult,
  priorSets: SetResult[],
): PRResult {
  const candE1rm = isE1rmEligible(candidate)
    ? e1rm(candidate.weightLb, candidate.reps)
    : null;
  const kinds: PRKind[] = [];

  if (!candidate.completed) return { kinds, e1rm: candE1rm };
  const prior = priorSets.filter((s) => s.completed);
  if (prior.length === 0) return { kinds, e1rm: candE1rm };

  // Weight PR — loaded lifts only.
  if (candidate.weightLb > 0) {
    const maxWeight = Math.max(...prior.map((s) => s.weightLb));
    if (candidate.weightLb > maxWeight) kinds.push('weight');
  }

  // Rep PR — most reps at this exact weight (bodyweight included: 0 === 0).
  const atWeight = prior.filter((s) => s.weightLb === candidate.weightLb);
  if (atWeight.length > 0) {
    const maxReps = Math.max(...atWeight.map((s) => s.reps));
    if (candidate.reps > maxReps) kinds.push('reps');
  }

  // e1RM PR.
  if (candE1rm !== null) {
    const priorE1rms = prior
      .filter(isE1rmEligible)
      .map((s) => e1rm(s.weightLb, s.reps));
    if (priorE1rms.length === 0 || candE1rm > Math.max(...priorE1rms)) {
      kinds.push('e1rm');
    }
  }

  return { kinds, e1rm: candE1rm };
}
