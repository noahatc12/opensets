import { describe, it, expect } from 'vitest';
import { generatePlan, type GenExercise, type GenProfile, type GenPreferences } from './index';

/* A compact catalog fixture covering every movement pattern, with a couple of
   patterns doubled so day-to-day variety is testable. Real catalog (873 ex) isn't
   imported — it's gitignored/generated, and the generator only needs this shape. */
const ex = (
  id: string,
  name: string,
  primaryMuscles: GenExercise['primaryMuscles'],
  equipment: string,
  mechanic: 'compound' | 'isolation',
  isBodyweight = false,
): GenExercise => ({ id, name, nameNorm: name.toLowerCase(), primaryMuscles, equipment, mechanic, isBodyweight });

const CATALOG: GenExercise[] = [
  ex('bb-bench', 'Barbell Bench Press', ['chest'], 'barbell', 'compound'),
  ex('db-bench', 'Dumbbell Bench Press', ['chest'], 'dumbbell', 'compound'),
  ex('mach-press', 'Machine Chest Press', ['chest'], 'machine', 'compound'),
  ex('incl-db', 'Incline Dumbbell Press', ['chest'], 'dumbbell', 'compound'),
  ex('ohp', 'Standing Military Press', ['shoulders'], 'barbell', 'compound'),
  ex('db-press', 'Seated Dumbbell Press', ['shoulders'], 'dumbbell', 'compound'),
  ex('lat-raise', 'Side Lateral Raise', ['shoulders'], 'dumbbell', 'isolation'),
  ex('face-pull', 'Face Pull', ['shoulders'], 'cable', 'isolation'),
  ex('pushdown', 'Triceps Pushdown', ['triceps'], 'cable', 'isolation'),
  ex('bb-curl', 'Barbell Curl', ['biceps'], 'barbell', 'isolation'),
  ex('incl-curl', 'Incline Dumbbell Curl', ['biceps'], 'dumbbell', 'isolation'),
  ex('squat', 'Barbell Squat', ['quadriceps'], 'barbell', 'compound'),
  ex('leg-press', 'Leg Press', ['quadriceps'], 'machine', 'compound'),
  ex('leg-ext', 'Leg Extensions', ['quadriceps'], 'machine', 'isolation'),
  ex('rdl', 'Romanian Deadlift', ['hamstrings', 'glutes'], 'barbell', 'compound'),
  ex('leg-curl', 'Lying Leg Curls', ['hamstrings'], 'machine', 'isolation'),
  ex('calf', 'Standing Calf Raises', ['calves'], 'machine', 'isolation'),
  ex('pulldown', 'Wide-Grip Lat Pulldown', ['lats'], 'cable', 'compound'),
  ex('pullup', 'Pullups', ['lats'], 'bodyweight', 'compound', true),
  ex('bb-row', 'Bent Over Barbell Row', ['middleBack', 'lats'], 'barbell', 'compound'),
  ex('cable-row', 'Seated Cable Rows', ['middleBack', 'lats'], 'cable', 'compound'),
  ex('hlr', 'Hanging Leg Raise', ['abdominals'], 'bodyweight', 'isolation', true),
  ex('cable-crunch', 'Cable Crunch', ['abdominals'], 'cable', 'isolation'),
];

const baseProfile: GenProfile = { goal: 'Build muscle' };
const basePrefs: GenPreferences = { days: 4, equipment: 'Full gym', experience: 'Intermediate' };
const gen = (p: Partial<GenProfile> = {}, q: Partial<GenPreferences> = {}) =>
  generatePlan(CATALOG, { ...baseProfile, ...p }, { ...basePrefs, ...q });

const allSlots = (r: ReturnType<typeof gen>) => r.program.days.flatMap((d) => d.slots);

describe('generatePlan — contract shape (§2.1)', () => {
  it('returns the full coached-plan contract with valid scaffolds', () => {
    const r = gen();
    expect(r.program.days.length).toBeGreaterThan(0);
    expect(r.program.name).toMatch(/\d+d/);
    // Scaffolds: shape present, empty-but-valid this session.
    expect(r.cardioProtocol).toEqual({ weeklyMinutesTarget: 0, dailyStepTarget: 0, sessions: [] });
    expect(r.goals).toEqual([]);
    expect(r.calibrationWeek.isCalibrationWeek).toBe(true);
    expect(r.calibrationWeek.topSetRepRange).toEqual([8, 10]);
  });
});

describe('mesocycle attached for block-periodized programs (§2.2)', () => {
  it('hypertrophy gets a mesocycle with volume targets for trained muscles', () => {
    const r = gen({ goal: 'Build muscle', goalTimeframeWeeks: 8 }, { experience: 'Intermediate' });
    expect(r.mesocycle).not.toBeNull();
    expect(r.mesocycle!.totalWeeks).toBe(8);
    expect(r.mesocycle!.weekIndex).toBe(0);
    expect(r.mesocycle!.phase).toBe('accumulation');
    expect(Object.keys(r.mesocycle!.volumeTargets).length).toBeGreaterThan(0);
    // a trained muscle carries MEV/MAV/MRV landmarks
    const anyTarget = Object.values(r.mesocycle!.volumeTargets)[0]!;
    expect(anyTarget.mev).toBeLessThan(anyTarget.mrv);
  });

  it('GZCLP (get-stronger + novice) is self-periodizing → no mesocycle', () => {
    expect(gen({ goal: 'Get stronger' }, { experience: 'Novice' }).mesocycle).toBeNull();
  });
});

describe('goal-override rule selection (§2.4)', () => {
  it('uses GZCLP for get-stronger + novice', () => {
    const kinds = new Set(allSlots(gen({ goal: 'Get stronger' }, { experience: 'Novice' })).map((s) => s.rule.kind));
    expect(kinds.has('gzclp')).toBe(true);
    // tiers assigned: a T1 main lift exists
    const tiers = allSlots(gen({ goal: 'Get stronger' }, { experience: 'Novice' }))
      .map((s) => (s.rule.kind === 'gzclp' ? s.rule.tier : null))
      .filter((t): t is 1 | 2 | 3 => t !== null);
    expect(tiers).toContain(1);
    expect(tiers).toContain(3);
  });

  it('does NOT use GZCLP/5-3-1 for get-stronger + intermediate (5/3/1 deferred to S10 → linear)', () => {
    const kinds = new Set(allSlots(gen({ goal: 'Get stronger' }, { experience: 'Intermediate' })).map((s) => s.rule.kind));
    expect(kinds.has('gzclp')).toBe(false);
    expect(kinds.has('percent531')).toBe(false);
    expect(kinds.has('linear')).toBe(true); // compounds are linear for strength
  });

  it('uses double progression for hypertrophy', () => {
    const compoundRules = allSlots(gen({ goal: 'Build muscle' })).filter((s) => s.compound).map((s) => s.rule.kind);
    expect(compoundRules.every((k) => k === 'double')).toBe(true);
  });
});

describe('curated selection is goal-aware (§2.3)', () => {
  it('strength favors the barbell compound; plans differ by goal', () => {
    const strength = gen({ goal: 'Get stronger' }, { experience: 'Intermediate' });
    const hyper = gen({ goal: 'Build muscle' }, { experience: 'Intermediate' });
    // The squat slot picked for strength is the barbell squat (goal emphasis).
    const strengthSquat = allSlots(strength).find((s) => s.exerciseName.toLowerCase().includes('squat'));
    expect(strengthSquat?.exerciseId).toBe('squat');
    // Plans are differentiated (rule kinds differ across the two goals).
    const sKinds = JSON.stringify([...new Set(allSlots(strength).map((s) => s.rule.kind))].sort());
    const hKinds = JSON.stringify([...new Set(allSlots(hyper).map((s) => s.rule.kind))].sort());
    expect(sKinds).not.toBe(hKinds);
  });

  it('rotates exercises across repeated days (variety, not the same day twice)', () => {
    const r = gen({}, { days: 6 }); // Push/Pull/Legs ×2
    const perDay = r.program.days[0]!.slots.length;
    const distinct = new Set(allSlots(r).map((s) => s.exerciseId)).size;
    expect(distinct).toBeGreaterThan(perDay); // more than one day's worth of distinct lifts
  });
});

describe('profile-scaled seeds (§2.6)', () => {
  it('a heavier/advanced male seeds higher than a lighter/novice female on the same lift', () => {
    const big = gen({ goal: 'Get stronger', sex: 'male', bodyweightLb: 220 }, { experience: 'Advanced' });
    const small = gen({ goal: 'Get stronger', sex: 'female', bodyweightLb: 120 }, { experience: 'Novice' });
    const bigSquat = allSlots(big).find((s) => s.exerciseId === 'squat')!;
    const smallSquat = allSlots(small).find((s) => s.exerciseId === 'squat')!;
    expect(bigSquat.startWeightLb).toBeGreaterThan(smallSquat.startWeightLb);
  });

  it('bodyweight lifts seed at 0', () => {
    const r = gen();
    const pullup = allSlots(r).find((s) => s.exerciseId === 'pullup');
    if (pullup) expect(pullup.startWeightLb).toBe(0);
  });
});

describe('profile matrix (§2.15) — every profile yields a sane, differentiated plan', () => {
  const goals = ['Build muscle', 'Lose fat', 'Recomposition', 'Get stronger'] as const;
  const exps = ['Novice', 'Intermediate', 'Advanced'] as const;
  const sexes = ['male', 'female'] as const;
  const dayCounts = [3, 4, 5, 6];

  for (const goal of goals)
    for (const experience of exps)
      for (const sex of sexes)
        for (const days of dayCounts) {
          it(`${goal} / ${experience} / ${sex} / ${days}d → valid plan`, () => {
            const r = gen({ goal, sex, bodyweightLb: 175 }, { experience, days });
            expect(r.program.days.length).toBe(days <= 6 ? days : 3);
            for (const day of r.program.days) {
              expect(day.slots.length).toBeGreaterThan(0);
              for (const s of day.slots) {
                expect(typeof s.rule.kind).toBe('string');
                expect(s.startWeightLb).toBeGreaterThanOrEqual(0);
                expect(s.scheme.sets).toBeGreaterThan(0);
              }
            }
          });
        }
});
