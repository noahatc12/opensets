/** Shared option lists for the goal-aware preference inputs (R1), used by both the
 *  onboarding wizard and Settings → Profile so the choices never drift apart. */
import type { Muscle, SplitChoice } from '../../db/types';

/** Split choices. 'auto' lets the split designer (R2) decide by goal/days/training-age. */
export const SPLITS: { id: SplitChoice; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'fullBody', label: 'Full-body' },
  { id: 'upperLower', label: 'Upper/Lower' },
  { id: 'pushPullLegs', label: 'PPL' },
  { id: 'pplArms', label: 'PPL + Arms' },
  { id: 'bodyPart', label: 'Body-part' },
];

/** Priority/lagging-muscle picks — curated to the commonly-prioritized groups, not
 *  the full granular taxonomy. (`lats` stands in for "Back" at this granularity.) */
export const PRIORITY_MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'lats', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'quadriceps', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'calves', label: 'Calves' },
  { id: 'abdominals', label: 'Abs' },
];
