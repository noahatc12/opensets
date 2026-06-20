import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { newId } from '../../db/ids';
import type { Goal, GoalType } from '../../db/types';
import { ChevronLeftIcon, PlusIcon } from '../../components/icons';

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
  { value: 'liftTarget', label: 'Lift target', unit: 'kg' },
  { value: 'bodyweight', label: 'Bodyweight', unit: 'kg' },
  { value: 'measurement', label: 'Body measurement', unit: 'cm' },
  { value: 'weeklyCardioMin', label: 'Weekly cardio', unit: 'min' },
  { value: 'weeklySetsMuscle', label: 'Weekly sets / muscle', unit: 'sets' },
  { value: 'streak', label: 'Training streak', unit: 'weeks' },
];

const typeMeta = (t: GoalType) => GOAL_TYPES.find((g) => g.value === t);

function goalTitle(goal: Goal): string {
  const meta = typeMeta(goal.type);
  const label = meta?.label ?? goal.type;
  const unit = meta?.unit ?? '';
  return `${label} ${goal.target}${unit ? ` ${unit}` : ''}`.trim();
}

function goalSubline(goal: Goal): string {
  const meta = typeMeta(goal.type);
  const unit = meta?.unit ?? '';
  const verb = goal.direction === 'increase' ? 'Reach' : 'Reduce to';
  return `${verb} ${goal.target}${unit ? ` ${unit}` : ''} · tracking`;
}

function GoalCard({ goal }: { goal: Goal }) {
  // No stored current value yet — show the target honestly at 0% rather than
  // inventing a percentage. Achieved goals read full.
  const pct = goal.status === 'achieved' ? 100 : 0;
  return (
    <div
      className="rounded-[var(--r-md)] border"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border-card)',
        padding: '16px 18px',
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="whitespace-nowrap text-[14px] font-semibold text-text">
          {goalTitle(goal)}
        </span>
        <span
          className="text-[13px]"
          style={{ ...numFont, color: pct > 0 ? 'var(--accent)' : 'var(--muted)' }}
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
      <div className="mt-2 text-[11.5px] text-muted" style={{ fontFamily: 'var(--font-num)' }}>
        {goalSubline(goal)}
      </div>
    </div>
  );
}

function AddGoalSheet({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<GoalType>('liftTarget');
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<Goal['direction']>('increase');

  const unit = typeMeta(type)?.unit ?? '';
  const targetNum = Number(target);
  const valid = target.trim() !== '' && Number.isFinite(targetNum) && targetNum > 0;

  async function save() {
    if (!valid) return;
    const goal: Goal = {
      id: newId(),
      type,
      target: targetNum,
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
        style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 h-1 w-9 rounded-full" style={{ background: 'var(--border-strong)' }} />
        <div className="mb-3.5 text-[17px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
          New goal
        </div>

        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-faint">
          Type
        </label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {GOAL_TYPES.map((g) => {
            const active = type === g.value;
            return (
              <button
                key={g.value}
                onClick={() => setType(g.value)}
                className="rounded-[var(--r-pill)] px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  background: active ? 'var(--accent)' : 'var(--bg)',
                  color: active ? 'var(--accent-ink)' : 'var(--muted)',
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-faint">
          Target{unit ? ` (${unit})` : ''}
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="0"
          className="mb-4 w-full rounded-[var(--r-md)] border px-3.5 py-3 text-[15px] text-text outline-none"
          style={{ ...numFont, background: 'var(--bg)', borderColor: 'var(--border-card)' }}
        />

        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-faint">
          Direction
        </label>
        <div className="mb-5 flex gap-1 rounded-[var(--r-sm)] p-1" style={{ background: 'var(--bg)' }}>
          {(['increase', 'decrease'] as const).map((d) => {
            const active = direction === d;
            return (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className="flex-1 rounded-[7px] py-2 text-[13px]"
                style={{
                  fontWeight: active ? 700 : 600,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-ink)' : 'var(--muted)',
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
            background: valid ? 'var(--accent)' : 'var(--surface-2)',
            color: valid ? 'var(--accent-ink)' : 'var(--faint)',
          }}
        >
          Save goal
        </button>
      </div>
    </div>
  );
}

export function GoalsScreen() {
  const navigate = useNavigate();
  const goals = useLiveQuery(() => db.goals.toArray());
  const [adding, setAdding] = useState(false);

  const active = (goals ?? []).filter((g) => g.status !== 'abandoned');

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-[18px] pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate('/settings')}
          className="grid size-10 place-items-center bg-transparent text-muted"
          aria-label="Back"
        >
          <ChevronLeftIcon className="size-[22px]" />
        </button>
        <div
          className="text-[20px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-snug)' }}
        >
          Goals
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-7 pt-1.5">
        {active.length > 0 ? (
          <div className="flex flex-col gap-3">
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-center text-[12.5px] leading-snug text-faint">
            No goals yet. Set a target to track progress against your training.
          </p>
        )}

        <button
          onClick={() => setAdding(true)}
          className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] text-[14px] font-semibold text-accent"
          style={{ border: '1px dashed var(--border-strong)', background: 'transparent' }}
        >
          <PlusIcon className="size-[18px]" />
          New goal
        </button>
      </div>

      {adding && <AddGoalSheet onClose={() => setAdding(false)} />}
    </div>
  );
}
