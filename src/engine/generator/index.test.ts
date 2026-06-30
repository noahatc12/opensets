import { describe, it, expect } from 'vitest';
import { generatePlan, splitSequence, type GenExercise, type GenProfile, type GenPreferences } from './index';

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

describe('per-slot prescription fields populated (§3.3/§3.4/§3.7)', () => {
  it('every slot carries a non-empty tempo, coaching cue, and rest tier', () => {
    for (const s of allSlots(gen())) {
      expect(s.tempo).toMatch(/^\d-\d-\d-\d$/); // 4-digit tempo
      expect(s.coachingCue.length).toBeGreaterThan(0);
      expect(['heavy', 'compound', 'accessory', 'isolation', 'pump']).toContain(s.restTier);
    }
  });

  it('the values are per-exercise, not one hardcoded value', () => {
    const slots = allSlots(gen());
    expect(new Set(slots.map((s) => s.coachingCue)).size).toBeGreaterThan(1);
    expect(new Set(slots.map((s) => s.restTier)).size).toBeGreaterThan(1);
    // a heavy compound (squat) rests in a heavier tier than a pump iso (lateral raise)
    const squat = slots.find((s) => s.exerciseId === 'squat');
    const lat = slots.find((s) => s.exerciseId === 'lat-raise');
    if (squat && lat) {
      expect(squat.restTier).toBe('heavy');
      expect(lat.restTier).toBe('pump');
    }
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
  const goals = ['Build muscle', 'Lose fat', 'Recomposition', 'Get stronger', 'General fitness'] as const;
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

/* ── R2: goal/training-age-aware split designer ─────────────────────────────────── */

// Count generated slots whose chosen exercise's primary muscle includes `muscle`.
const muscleSlotCount = (r: ReturnType<typeof gen>, muscle: GenExercise['primaryMuscles'][number]) =>
  allSlots(r).filter((s) => {
    const ex = CATALOG.find((e) => e.id === s.exerciseId);
    return ex?.primaryMuscles.includes(muscle);
  }).length;

describe('split designer — matrix coherence (§2.3 / R2)', () => {
  it('produces structurally DIFFERENT, class-appropriate splits across the goal × training-age space', () => {
    const noviceAny = splitSequence('Build muscle', 'Novice', 3, 'auto', []);
    const hyperInt5 = splitSequence('Build muscle', 'Intermediate', 5, 'auto', []);
    const strengthInt4 = splitSequence('Get stronger', 'Intermediate', 4, 'auto', []);
    const generalFit3 = splitSequence('General fitness', 'Intermediate', 3, 'auto', []);
    const advHyper6 = splitSequence('Build muscle', 'Advanced', 6, 'auto', []);

    // Each is sensible for its class…
    expect(noviceAny).toEqual(['Full', 'Full', 'Full']); // novices collapse to full-body
    expect(hyperInt5).toEqual(['Push', 'Pull', 'Legs', 'Upper', 'Lower']); // hypertrophy distributes volume
    expect(strengthInt4).toEqual(['Upper', 'Lower', 'Upper', 'Lower']); // strength: compounds recur
    expect(generalFit3).toEqual(['Full', 'Full', 'Full']); // balanced full-body
    expect(advHyper6).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']); // PPL×2 high end

    // …and the matrix is NOT one skeleton relabeled — goal-awareness is real.
    const shapes = new Set([hyperInt5, strengthInt4, advHyper6].map((s) => JSON.stringify(s)));
    expect(shapes.size).toBe(3);
    // Same days, different goal/age → different structure (the skew-guard).
    expect(splitSequence('Build muscle', 'Intermediate', 3, 'auto', [])) // PPL
      .not.toEqual(splitSequence('Get stronger', 'Intermediate', 3, 'auto', [])); // Full×3
  });

  it('honors an explicit splitChoice when it fits the day count', () => {
    expect(splitSequence('Build muscle', 'Intermediate', 4, 'upperLower', [])).toEqual(['Upper', 'Lower', 'Upper', 'Lower']);
    expect(splitSequence('Build muscle', 'Intermediate', 5, 'fullBody', [])).toEqual(['Full', 'Full', 'Full', 'Full', 'Full']);
    expect(splitSequence('Build muscle', 'Intermediate', 5, 'pplArms', [])).toEqual(['Push', 'Pull', 'Legs', 'Arms', 'Upper']);
    expect(splitSequence('Build muscle', 'Intermediate', 5, 'bodyPart', [])).toEqual(['Chest', 'Back', 'Shoulders', 'Legs', 'Arms']);
    expect(splitSequence('Build muscle', 'Intermediate', 6, 'pushPullLegs', [])).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']);
  });

  it('covers each split family at its other fitting day counts + non-fitting fallbacks', () => {
    expect(splitSequence('Build muscle', 'Intermediate', 6, 'upperLower', [])).toEqual(['Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Lower']);
    expect(splitSequence('Build muscle', 'Intermediate', 3, 'pushPullLegs', [])).toEqual(['Push', 'Pull', 'Legs']);
    expect(splitSequence('Build muscle', 'Intermediate', 4, 'pplArms', [])).toEqual(['Push', 'Pull', 'Legs', 'Arms']);
    expect(splitSequence('Build muscle', 'Intermediate', 6, 'bodyPart', [])).toEqual(['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Upper']);
    // non-fitting day counts → fall back to auto
    expect(splitSequence('Build muscle', 'Intermediate', 3, 'upperLower', [])).toEqual(['Push', 'Pull', 'Legs']);
    expect(splitSequence('Build muscle', 'Intermediate', 4, 'bodyPart', [])).toEqual(['Upper', 'Lower', 'Upper', 'Lower']);
  });

  it('priority emphasis is robust to unmapped + non-trained muscles (no spurious slots, no crash)', () => {
    // 'traps' has no priority pattern; 'calves' trains nothing on a 4-day UL upper portion —
    // both must leave the plan valid and not error.
    const r = gen({ goal: 'Build muscle' }, { experience: 'Intermediate', days: 4, priorityMuscles: ['traps', 'calves'] });
    expect(r.program.days.every((d) => d.slots.length > 0)).toBe(true);
    // fullBody + arm priority reallocates a Full day to Arms (covers the 'Full' branch).
    expect(splitSequence('Build muscle', 'Intermediate', 5, 'fullBody', ['biceps'])).toContain('Arms');
  });

  it('falls back to the auto split when the chosen split does NOT fit the days (days = hard constraint)', () => {
    // pplArms needs ≥4 days; at 3 days it cannot fit → auto (hypertrophy/int/3 = PPL), no Arms day.
    const fallback = splitSequence('Build muscle', 'Intermediate', 3, 'pplArms', []);
    expect(fallback).toEqual(['Push', 'Pull', 'Legs']);
    expect(fallback).not.toContain('Arms');
    // pushPullLegs needs 3 or 6; at 4 days → auto (UL).
    expect(splitSequence('Build muscle', 'Intermediate', 4, 'pushPullLegs', [])).toEqual(['Upper', 'Lower', 'Upper', 'Lower']);
  });

  it('priorityMuscles earns a dedicated Arms day when day-budget allows, not for novices/low days', () => {
    const base = splitSequence('Build muscle', 'Intermediate', 5, 'auto', []);
    const armPrio = splitSequence('Build muscle', 'Intermediate', 5, 'auto', ['biceps', 'triceps']);
    expect(base).not.toContain('Arms');
    expect(armPrio).toContain('Arms'); // an Upper day was reallocated to Arms
    expect(armPrio).not.toEqual(base);
    // Novices never get a specialization day (collapse to full-body); 4 days lacks the budget.
    expect(splitSequence('Build muscle', 'Novice', 5, 'auto', ['biceps', 'triceps'])).not.toContain('Arms');
    expect(splitSequence('Build muscle', 'Intermediate', 4, 'auto', ['biceps', 'triceps'])).not.toContain('Arms');
  });

  it('priorityMuscles biases exercise exposure toward the priority muscle (emphasis within structure)', () => {
    // Chest priority at 4 days (no arm specialization) → more chest slots than the same plan without it.
    const withChest = gen({ goal: 'Build muscle' }, { experience: 'Intermediate', days: 4, priorityMuscles: ['chest'] });
    const without = gen({ goal: 'Build muscle' }, { experience: 'Intermediate', days: 4 });
    expect(muscleSlotCount(withChest, 'chest')).toBeGreaterThan(muscleSlotCount(without, 'chest'));
  });

  it('is deterministic — same inputs yield the same split and the same plan (variety is R4, not R2)', () => {
    const a = splitSequence('Recomposition', 'Advanced', 6, 'pushPullLegs', ['chest']);
    const b = splitSequence('Recomposition', 'Advanced', 6, 'pushPullLegs', ['chest']);
    expect(a).toEqual(b);
    const p1 = gen({ goal: 'Recomposition' }, { experience: 'Advanced', days: 6, priorityMuscles: ['chest'] });
    const p2 = gen({ goal: 'Recomposition' }, { experience: 'Advanced', days: 6, priorityMuscles: ['chest'] });
    expect(JSON.stringify(p1)).toBe(JSON.stringify(p2));
  });
});
