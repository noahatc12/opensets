/**
 * R4 · the vetted exercise library (2026-10-14; designed 2026-07-07, see the project
 * file's R4 BUILD PLAN). Each movement pattern has a short list of vetted catalog ids,
 * each tagged with the job it does for the muscle:
 *
 *   heavy   — the big loadable lift, usually short to mid muscle length
 *   stretch — loads the muscle long (lengthened bias, research Part 1)
 *   squeeze — peak contraction at the short end
 *
 * Selection walks these before any generic name match, so a plan is built from lifts a
 * coach would program, and a second slot for the same muscle on the same day takes a
 * different job (bench, then incline dumbbell press; never bench then decline bench).
 * Roles derive from mechanics and coaching practice, not EMG, and no proprietary
 * program's tables are copied (the IP boundary). Cues belong to the EXERCISE, so a hip
 * thrust in a hinge slot no longer inherits the hamstring cue.
 *
 * Ids are free-exercise-db ids at the pinned SHA. Order inside a role is the default
 * pick order; a seed may rotate among equals.
 */

export type Role = 'heavy' | 'stretch' | 'squeeze';

export interface Vetted {
  id: string;
  role: Role;
  cue: string;
}

export const VETTED: Readonly<Record<string, readonly Vetted[]>> = {
  horizPress: [
    {
      id: 'Barbell_Bench_Press_-_Medium_Grip',
      role: 'heavy',
      cue: 'Shoulder blades pinned; touch the lower chest, drive up.',
    },
    {
      id: 'Dumbbell_Bench_Press',
      role: 'heavy',
      cue: 'Let the dumbbells sink to a deep stretch; press up and slightly in.',
    },
    {
      id: 'Machine_Bench_Press',
      role: 'heavy',
      cue: 'Handles start at mid-chest; press without shrugging.',
    },
    {
      id: 'Incline_Dumbbell_Press',
      role: 'stretch',
      cue: 'Low incline; lower until the chest stretches, then press.',
    },
    {
      id: 'Dumbbell_Flyes',
      role: 'stretch',
      cue: 'Soft elbows; open wide into the stretch, hug back up.',
    },
    {
      id: 'Butterfly',
      role: 'squeeze',
      cue: 'Chest up; squeeze the handles together and hold a beat.',
    },
    {
      id: 'Cable_Crossover',
      role: 'squeeze',
      cue: 'Lean in slightly; cross the hands and squeeze the chest.',
    },
  ],
  inclPress: [
    {
      id: 'Incline_Dumbbell_Press',
      role: 'stretch',
      cue: 'Low incline; lower until the chest stretches, then press.',
    },
    {
      id: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
      role: 'heavy',
      cue: 'Bar to the upper chest; elbows under the wrists.',
    },
    {
      id: 'Incline_Dumbbell_Flyes',
      role: 'stretch',
      cue: 'Soft elbows; open into the stretch, hug back up.',
    },
    {
      id: 'Low_Cable_Crossover',
      role: 'squeeze',
      cue: 'Sweep up and in to chin height; squeeze the upper chest.',
    },
  ],
  vertPress: [
    {
      id: 'Standing_Military_Press',
      role: 'heavy',
      cue: 'Brace hard; press in a straight line past the forehead.',
    },
    {
      id: 'Seated_Dumbbell_Press',
      role: 'heavy',
      cue: 'Back on the pad; lower to ear height, press without arching.',
    },
    {
      id: 'Machine_Shoulder_Military_Press',
      role: 'heavy',
      cue: 'Seat so the handles start at shoulder height; press smooth.',
    },
    {
      id: 'Dumbbell_Shoulder_Press',
      role: 'heavy',
      cue: 'Lower to ear height; press up without arching the back.',
    },
  ],
  lateralRaise: [
    {
      id: 'Side_Lateral_Raise',
      role: 'squeeze',
      cue: 'Lead with the elbows; raise to shoulder height, no swing.',
    },
    {
      id: 'Cable_Seated_Lateral_Raise',
      role: 'stretch',
      cue: 'Start across the body; sweep out to shoulder height.',
    },
    {
      id: 'Seated_Side_Lateral_Raise',
      role: 'squeeze',
      cue: 'Seated, no momentum; elbows lead to shoulder height.',
    },
    {
      id: 'Lateral_Raise_-_With_Bands',
      role: 'squeeze',
      cue: 'Elbows lead; pause at the top where the band is tightest.',
    },
  ],
  rearDelt: [
    {
      id: 'Face_Pull',
      role: 'squeeze',
      cue: 'Pull to the eyes, hands apart; squeeze the rear delts.',
    },
    {
      id: 'Reverse_Machine_Flyes',
      role: 'squeeze',
      cue: 'Arms long; sweep back and squeeze, not the traps.',
    },
    {
      id: 'Cable_Rear_Delt_Fly',
      role: 'stretch',
      cue: 'Start crossed; sweep back wide and slow.',
    },
    {
      id: 'Reverse_Flyes',
      role: 'squeeze',
      cue: 'Hinge forward; lead with the elbows and squeeze.',
    },
  ],
  tricep: [
    {
      id: 'Cable_Rope_Overhead_Triceps_Extension',
      role: 'stretch',
      cue: 'Elbows by the ears; let the rope reach deep behind the head.',
    },
    {
      id: 'Triceps_Pushdown_-_Rope_Attachment',
      role: 'squeeze',
      cue: 'Pin the elbows; split the rope and lock out hard.',
    },
    {
      id: 'EZ-Bar_Skullcrusher',
      role: 'stretch',
      cue: 'Lower behind the forehead; elbows stay pointed up.',
    },
    {
      id: 'Close-Grip_Barbell_Bench_Press',
      role: 'heavy',
      cue: 'Hands shoulder width; elbows tucked, press to lockout.',
    },
    {
      id: 'Dips_-_Triceps_Version',
      role: 'heavy',
      cue: 'Stay upright; lower to a 90 degree elbow, lock out.',
    },
    {
      id: 'Dumbbell_One-Arm_Triceps_Extension',
      role: 'stretch',
      cue: 'Elbow up by the ear; lower deep behind the head.',
    },
    {
      id: 'Triceps_Pushdown',
      role: 'squeeze',
      cue: 'Pin the elbows; lock out and squeeze.',
    },
  ],
  biceps: [
    {
      id: 'Incline_Dumbbell_Curl',
      role: 'stretch',
      cue: 'Arms hang behind the body; curl without the elbows drifting.',
    },
    {
      id: 'Barbell_Curl',
      role: 'heavy',
      cue: 'Elbows still; no swing, control the way down.',
    },
    {
      id: 'EZ-Bar_Curl',
      role: 'heavy',
      cue: 'Elbows still; squeeze at the top, slow down.',
    },
    {
      id: 'Hammer_Curls',
      role: 'heavy',
      cue: 'Thumbs up; curl without the elbows moving forward.',
    },
    {
      id: 'Preacher_Curl',
      role: 'squeeze',
      cue: 'Arms flat on the pad; squeeze hard at the top.',
    },
    {
      id: 'Standing_Biceps_Cable_Curl',
      role: 'squeeze',
      cue: 'Elbows pinned; squeeze and hold a beat at the top.',
    },
    {
      id: 'Dumbbell_Bicep_Curl',
      role: 'heavy',
      cue: 'Turn the palms up as you curl; no swing.',
    },
  ],
  squat: [
    {
      id: 'Barbell_Squat',
      role: 'heavy',
      cue: 'Brace, sit between the hips, knees track over the toes.',
    },
    {
      id: 'Front_Barbell_Squat',
      role: 'heavy',
      cue: 'Elbows high; stay upright and sit straight down.',
    },
    {
      id: 'Hack_Squat',
      role: 'heavy',
      cue: 'Feet mid-plate; sink deep, drive through the whole foot.',
    },
    {
      id: 'Smith_Machine_Squat',
      role: 'heavy',
      cue: 'Feet a touch forward; sit deep under control.',
    },
    {
      id: 'Goblet_Squat',
      role: 'heavy',
      cue: 'Hold the bell at the chest; sit between the heels.',
    },
    {
      id: 'Dumbbell_Squat',
      role: 'heavy',
      cue: 'Dumbbells at the sides; brace and sit deep.',
    },
  ],
  legPress: [
    {
      id: 'Leg_Press',
      role: 'heavy',
      cue: 'Lower until the hips want to tuck; press through the whole foot.',
    },
    {
      id: 'Split_Squat_with_Dumbbells',
      role: 'stretch',
      cue: 'Long stance; drop the back knee, front shin stays still.',
    },
    {
      id: 'Dumbbell_Lunges',
      role: 'stretch',
      cue: 'Step long; back knee to the floor, push off the front heel.',
    },
    {
      id: 'Barbell_Walking_Lunge',
      role: 'stretch',
      cue: 'Long steps; stay tall, drive through the front heel.',
    },
    {
      id: 'Dumbbell_Rear_Lunge',
      role: 'stretch',
      cue: 'Step back long; front knee stays over the foot.',
    },
  ],
  legExt: [
    {
      id: 'Leg_Extensions',
      role: 'squeeze',
      cue: 'Pause and squeeze the quads at the top.',
    },
  ],
  hinge: [
    {
      id: 'Romanian_Deadlift',
      role: 'stretch',
      cue: 'Hips back, flat back, feel the hamstrings stretch.',
    },
    {
      id: 'Barbell_Deadlift',
      role: 'heavy',
      cue: 'Bar over mid-foot; brace, push the floor away.',
    },
    {
      id: 'Stiff-Legged_Dumbbell_Deadlift',
      role: 'stretch',
      cue: 'Soft knees; hinge until the hamstrings stretch.',
    },
    {
      id: 'Barbell_Hip_Thrust',
      role: 'squeeze',
      cue: 'Chin tucked, ribs down; squeeze the glutes at the top.',
    },
    {
      id: 'Good_Morning',
      role: 'stretch',
      cue: 'Bar on the back; hips back with a flat back.',
    },
  ],
  legCurl: [
    {
      id: 'Seated_Leg_Curl',
      role: 'stretch',
      cue: 'Lean forward a touch; curl and slow the way back.',
    },
    {
      id: 'Lying_Leg_Curls',
      role: 'squeeze',
      cue: 'Hips down; squeeze the hamstrings, slow the negative.',
    },
    {
      id: 'Standing_Leg_Curl',
      role: 'squeeze',
      cue: 'One leg at a time; squeeze and lower slowly.',
    },
  ],
  calf: [
    {
      id: 'Standing_Calf_Raises',
      role: 'stretch',
      cue: 'Full stretch at the bottom, pause at the top.',
    },
    {
      id: 'Seated_Calf_Raise',
      role: 'squeeze',
      cue: 'Pause in the stretch; drive up and hold the top.',
    },
    {
      id: 'Calf_Press_On_The_Leg_Press_Machine',
      role: 'stretch',
      cue: 'Balls of the feet on the plate; deep stretch, full press.',
    },
    {
      id: 'Standing_Dumbbell_Calf_Raise',
      role: 'stretch',
      cue: 'Heel below the step; pause at the bottom and top.',
    },
  ],
  vertPull: [
    {
      id: 'Pullups',
      role: 'heavy',
      cue: 'Start from a dead hang; drive the elbows down.',
    },
    {
      id: 'Wide-Grip_Lat_Pulldown',
      role: 'heavy',
      cue: 'Chest up; pull to the upper chest, elbows down.',
    },
    {
      id: 'Chin-Up',
      role: 'heavy',
      cue: 'Palms in; dead hang, chest to the bar.',
    },
    {
      id: 'Close-Grip_Front_Lat_Pulldown',
      role: 'stretch',
      cue: 'Let the lats stretch at the top; pull to the chest.',
    },
    {
      id: 'V-Bar_Pulldown',
      role: 'stretch',
      cue: 'Full stretch overhead; pull the elbows to the ribs.',
    },
  ],
  horizRow: [
    {
      id: 'Seated_Cable_Rows',
      role: 'stretch',
      cue: 'Reach forward into the stretch; pull to the lower ribs.',
    },
    {
      id: 'Bent_Over_Barbell_Row',
      role: 'heavy',
      cue: 'Flat back; pull to the lower ribs, squeeze the shoulder blades.',
    },
    {
      id: 'Bent_Over_Two-Dumbbell_Row',
      role: 'heavy',
      cue: 'Flat back; row both dumbbells to the hips.',
    },
    {
      id: 'One-Arm_Dumbbell_Row',
      role: 'stretch',
      cue: 'Let the dumbbell hang low; row to the hip.',
    },
    {
      id: 'T-Bar_Row_with_Handle',
      role: 'heavy',
      cue: 'Chest proud; pull the handle to the ribs.',
    },
    {
      id: 'Lying_T-Bar_Row',
      role: 'squeeze',
      cue: 'Chest on the pad; pull and squeeze the shoulder blades.',
    },
  ],
  abs: [
    {
      id: 'Cable_Crunch',
      role: 'squeeze',
      cue: 'Round the spine, ribs to hips; hips stay still.',
    },
    {
      id: 'Hanging_Leg_Raise',
      role: 'stretch',
      cue: 'Dead hang; curl the pelvis up, no swing.',
    },
    {
      id: 'Ab_Roller',
      role: 'stretch',
      cue: 'Ribs down; roll out only as far as the back stays flat.',
    },
    {
      id: 'Reverse_Crunch',
      role: 'squeeze',
      cue: 'Curl the hips off the floor; lower slowly.',
    },
    {
      id: 'Plank',
      role: 'squeeze',
      cue: 'Ribs down, glutes tight; hold a straight line.',
    },
    {
      id: 'Dead_Bug',
      role: 'squeeze',
      cue: 'Low back pressed down; reach opposite arm and leg slowly.',
    },
  ],
};

/** Name fragments the generic fallback never picks: unstable-surface and novelty
 *  variants a coach would not program (the "Bosu Ball Cable Crunch" pick, review
 *  2026-10-14). */
export const ODD = [
  'bosu',
  'exercise ball',
  'stability ball',
  'balance board',
  'with side bends',
];

/** Default pick order of roles, by pattern kind and how many slots this muscle has
 *  already had today. The first compound slot is the heavy lift; the first isolation
 *  slot leans long (lengthened bias); a second slot takes the next job. */
export function roleOrder(
  compound: boolean,
  nthToday: number,
  strength: boolean,
): Role[] {
  if (strength && compound) return ['heavy', 'stretch', 'squeeze'];
  if (compound)
    return nthToday === 0
      ? ['heavy', 'stretch', 'squeeze']
      : ['stretch', 'squeeze', 'heavy'];
  return nthToday === 0
    ? ['stretch', 'squeeze', 'heavy']
    : ['squeeze', 'stretch', 'heavy'];
}

/** Tempo by role: a stretch slot pauses in the stretch, a squeeze slot holds the top. */
export function tempoFor(role: Role, patternTempo: string): string {
  if (role === 'squeeze') return '2-0-1-1';
  if (role === 'stretch') return '3-1-1-0';
  return patternTempo;
}

/** mulberry32: a tiny seeded PRNG so variety stays deterministic and engine-pure
 *  (Math.random is banned in the engine). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
