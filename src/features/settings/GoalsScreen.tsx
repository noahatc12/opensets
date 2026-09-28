import { useState } from 'react';
import { useNav } from '../../ui/nav';
import { Pushed } from '../../ui/Pushed';
import { SettingsScreen } from './SettingsScreen';
import { TabBar } from '../../components/TabBar';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { newId } from '../../db/ids';
import type { Goal, GoalType, Measurement } from '../../db/types';
import { PlusIcon } from '../../components/icons';
import { BackButton } from '../../ui/StatGrid';
import { useSettings } from '../../db/hooks';
import { e1rm, isE1rmEligible } from '../../engine';
import { fmtWeight, kgToLb, toUnit } from '../../lib/units';
import type { WeightUnit } from '../../lib/units';

/* Ported from the Tempo prototype Goals screen (showGoals): a back header +
   scroll list of goal cards (title · percent · progress bar · subline) and a
   dashed "New goal" affordance. The prototype's progress numbers are mock; we
   render the layout faithfully but only show honest data — goals have a target
   but no stored current value yet, so progress reads as "Tracking" at 0% until
   per-goal current sourcing lands, rather than fabricating a percentage. */

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};

const nowIso = () => new Date().toISOString();

const GOAL_TYPES: { value: GoalType; label: string; unit: string }[] = [
  { value: 'liftTarget', label: 'Lift target', unit: 'lb' },
  { value: 'bodyweight', label: 'Bodyweight', unit: 'lb' },
  { value: 'measurement', label: 'Body measurement', unit: 'in' },
  { value: 'weeklyCardioMin', label: 'Weekly cardio', unit: 'min' },
  { value: 'weeklySetsMuscle', label: 'Weekly sets / muscle', unit: 'sets' },
  { value: 'streak', label: 'Training streak', unit: 'weeks' },
];

const typeMeta = (t: GoalType) => GOAL_TYPES.find((g) => g.value === t);

/** Goal types whose target is a canonical-lb weight (everything else is in/min/etc). */
const isWeightGoal = (t: GoalType) => t === 'liftTarget' || t === 'bodyweight';

/** target value + unit label for display, converting weight targets to the user's unit. */
function displayTarget(
  goal: Goal,
  units: WeightUnit,
): { value: string; unit: string } {
  if (isWeightGoal(goal.type)) {
    return { value: fmtWeight(goal.target, units), unit: units };
  }
  const meta = typeMeta(goal.type);
  return { value: String(goal.target), unit: meta?.unit ?? '' };
}

function goalTitle(goal: Goal, units: WeightUnit): string {
  const meta = typeMeta(goal.type);
  const label = meta?.label ?? goal.type;
  const { value, unit } = displayTarget(goal, units);
  return `${label} ${value}${unit ? ` ${unit}` : ''}`.trim();
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** Latest measurement of a given type (max by date), or undefined if none. */
function latestMeasurement(
  rows: Measurement[],
  type: string,
): Measurement | undefined {
  let best: Measurement | undefined;
  for (const m of rows) {
    if (m.type !== type) continue;
    if (!best || m.date > best.date) best = m;
  }
  return best;
}

/** Progress toward a target given a direction. Both args canonical (lb / in). */
function pctToward(
  current: number,
  target: number,
  direction: Goal['direction'],
): number {
  if (target <= 0 || current <= 0) return 0;
  const ratio = direction === 'decrease' ? target / current : current / target;
  return clamp(ratio * 100, 0, 100);
}

/** Format a current/target line in the right unit. Weight goals convert to {units}. */
function progressSubline(
  goal: Goal,
  currentLb: number | null,
  units: WeightUnit,
): string {
  const { value: targetStr, unit } = displayTarget(goal, units);
  if (currentLb === null) {
    const verb = goal.direction === 'increase' ? 'Reach' : 'Reduce to';
    return `${verb} ${targetStr}${unit ? ` ${unit}` : ''} · tracking`;
  }
  const currentStr = isWeightGoal(goal.type)
    ? fmtWeight(currentLb, units)
    : String(Math.round(toUnit(currentLb, units) * 10) / 10);
  return `${currentStr} / ${targetStr}${unit ? ` ${unit}` : ''}`;
}

function GoalCard({ goal, units }: { goal: Goal; units: WeightUnit }) {
  // Best estimated 1RM for a liftTarget goal, from logged eligible sets.
  const liftCurrent = useLiveQuery(async () => {
    if (goal.type !== 'liftTarget' || !goal.exerciseId) return null;
    const sets = await db.sets
      .where('exerciseId')
      .equals(goal.exerciseId)
      .toArray();
    let best = 0;
    for (const s of sets) {
      if (s.deletedAt || !isE1rmEligible(s)) continue;
      best = Math.max(best, e1rm(s.weightLb, s.reps));
    }
    return best;
  }, [goal.type, goal.exerciseId]);

  // Latest bodyweight / body-measurement reading for those goal types.
  const measureRows = useLiveQuery(
    () =>
      goal.type === 'bodyweight' || goal.type === 'measurement'
        ? db.measurements.toArray()
        : Promise.resolve<Measurement[]>([]),
    [goal.type],
  );

  // Resolve current value (canonical lb/in) per goal type. null = no source mapped.
  let current: number | null = null;
  if (goal.type === 'liftTarget') {
    current = liftCurrent != null && liftCurrent > 0 ? liftCurrent : null;
  } else if (goal.type === 'bodyweight') {
    const m = latestMeasurement(measureRows ?? [], 'bodyweight');
    current = m?.valueLb ?? null;
  }
  // 'measurement' goals carry no measurement-type link on Goal, so they stay
  // unmapped (0%) rather than guessing which measurement to read.

  const pct =
    goal.status === 'achieved'
      ? 100
      : current === null
        ? 0
        : Math.round(pctToward(current, goal.target, goal.direction));

  return (
    <div
      className="os-card"
      style={{
        background: 'var(--surface)',

        padding: '16px 18px',
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="whitespace-nowrap text-[14px] font-semibold text-text">
          {goalTitle(goal, units)}
        </span>
        <span
          className="text-[13px]"
          style={{
            ...numFont,
            color: pct > 0 ? 'var(--acc-tx)' : 'var(--muted)',
          }}
        >
          {pct}%
        </span>
      </div>
      <div
        className="mt-2.5 h-[8px] overflow-hidden rounded-[5px]"
        style={{ background: 'var(--bg)' }}
      >
        <div
          className="h-full rounded-[5px]"
          style={{ width: `${pct}%`, background: 'var(--accent)' }}
        />
      </div>
      <div
        className="mt-2 text-[12px] text-muted"
        style={{ fontFamily: 'var(--font-num)' }}
      >
        {progressSubline(goal, current, units)}
        {current !== null ? ` · ${pct}%` : ''}
      </div>
    </div>
  );
}

function AddGoalSheet({
  onClose,
  units,
}: {
  onClose: () => void;
  units: WeightUnit;
}) {
  const [type, setType] = useState<GoalType>('liftTarget');
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<Goal['direction']>('increase');

  // Weight goals collect input in the user's unit and show {units}; others use their fixed unit.
  const weight = isWeightGoal(type);
  const unit = weight ? units : (typeMeta(type)?.unit ?? '');
  const targetNum = Number(target);
  const valid =
    target.trim() !== '' && Number.isFinite(targetNum) && targetNum > 0;

  async function save() {
    if (!valid) return;
    // Store canonical lb: convert weight targets entered in kg; everything else stored as-is.
    const storedTarget =
      weight && units === 'kg' ? kgToLb(targetNum) : targetNum;
    const goal: Goal = {
      id: newId(),
      type,
      target: storedTarget,
      direction,
      status: 'active',
      createdAt: nowIso(),
    };
    await db.goals.add(goal);
    onClose();
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col justify-end"
      style={{ background: 'color-mix(in oklab, var(--bg) 55%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-[var(--r-xl)] border-t px-[22px] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        style={{
          background: 'var(--surface)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-3.5 h-1 w-9 rounded-full"
          style={{ background: 'var(--border-strong)' }}
        />
        <div
          className="mb-3.5 text-[17px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-snug)' }}
        >
          New goal
        </div>

        <label className="os-t mb-1.5 block">Type</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {GOAL_TYPES.map((g) => {
            const active = type === g.value;
            return (
              <button
                key={g.value}
                onClick={() => setType(g.value)}
                className="rounded-[var(--r-pill)] px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  background: active ? 'var(--ink)' : 'var(--bg)',
                  color: active ? 'var(--bg)' : 'var(--muted)',
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        <label className="os-t mb-1.5 block">
          Target{unit ? ` (${unit})` : ''}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="0"
          className="mb-4 w-full os-card px-3.5 py-3 text-[15px] text-text outline-none"
          style={{
            ...numFont,
            background: 'var(--bg)',
          }}
        />

        <label className="os-t mb-1.5 block">Direction</label>
        <div
          className="mb-5 flex gap-1 rounded-[var(--r-sm)] p-1"
          style={{ background: 'var(--bg)' }}
        >
          {(['increase', 'decrease'] as const).map((d) => {
            const active = direction === d;
            return (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className="flex-1 rounded-[7px] py-2 text-[13px]"
                style={{
                  fontWeight: active ? 700 : 600,
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--muted)',
                }}
              >
                {d === 'increase' ? 'Increase' : 'Decrease'}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => void save()}
          disabled={!valid}
          className="h-12 w-full rounded-[var(--r-md)] text-[14px] font-bold"
          style={{
            background: valid ? 'var(--ink)' : 'var(--surface-2)',
            color: valid ? 'var(--bg)' : 'var(--faint)',
          }}
        >
          Save goal
        </button>
      </div>
    </div>
  );
}

export function GoalsScreen() {
  const nav = useNav();
  const { units } = useSettings();
  const goals = useLiveQuery(() => db.goals.toArray());
  const [adding, setAdding] = useState(false);

  const active = (goals ?? []).filter((g) => g.status !== 'abandoned');

  return (
    <Pushed
      to="/settings"
      parent={
        <>
          <SettingsScreen />
          <TabBar activePath="/settings" />
        </>
      }
    >
      <div className="relative flex h-full flex-col">
        <div className="px-[18px] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <BackButton onClick={() => nav.tab('/settings')} />
          <div className="os-t mt-3.5">You</div>
          <h1 className="os-h1 mt-0.5">Goals</h1>
        </div>

        <div className="os-scroll flex-1 overflow-auto px-[22px] pb-7 pt-1.5">
          {active.length > 0 ? (
            <div className="flex flex-col gap-3">
              {active.map((g) => (
                <GoalCard key={g.id} goal={g} units={units} />
              ))}
            </div>
          ) : (
            <p className="mt-8 text-center text-[12.5px] leading-snug text-faint">
              No goals yet. Set a target to track progress against your
              training.
            </p>
          )}

          <button
            onClick={() => setAdding(true)}
            className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] text-[14px] font-semibold text-accent"
            style={{
              border: '1px dashed var(--border-strong)',
              background: 'transparent',
            }}
          >
            <PlusIcon className="size-[18px]" />
            New goal
          </button>
        </div>

        {adding && (
          <AddGoalSheet onClose={() => setAdding(false)} units={units} />
        )}
      </div>
    </Pushed>
  );
}
