import type { Muscle } from '../../db/types';

/** Display muscle groups and the canonical muscles they cover. Shared by the Library
 *  filters and the Add exercise sheet so the two never drift. */
export const MUSCLE_GROUPS: {
  key: string;
  label: string;
  muscles: Muscle[];
}[] = [
  { key: 'chest', label: 'Chest', muscles: ['chest'] },
  {
    key: 'back',
    label: 'Back',
    muscles: ['lats', 'middleBack', 'lowerBack', 'traps'],
  },
  { key: 'shoulders', label: 'Shoulders', muscles: ['shoulders'] },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  {
    key: 'legs',
    label: 'Legs',
    muscles: [
      'quadriceps',
      'hamstrings',
      'glutes',
      'calves',
      'abductors',
      'adductors',
    ],
  },
  { key: 'core', label: 'Core', muscles: ['abdominals'] },
];

/** True when the exercise works any muscle of the group. */
export function inGroup(
  key: string,
  primary: Muscle[],
  secondary: Muscle[],
): boolean {
  const g = MUSCLE_GROUPS.find((x) => x.key === key);
  if (!g) return true;
  return [...primary, ...secondary].some((m) => g.muscles.includes(m));
}
