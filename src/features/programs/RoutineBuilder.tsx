import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Stepper } from '../../components/Stepper';
import { Segmented } from '../../components/Segmented';
import { ExercisePicker } from '../library/ExercisePicker';
import type { Exercise, ExerciseSlot } from '../../db/types';
import type { ProgressionRule } from '../../engine/types';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
} from '../../db/repositories';

type RuleKind = 'linear' | 'double' | 'manual';

interface SlotDraft {
  exercise: Exercise;
  ruleKind: RuleKind;
  sets: number;
  repTarget: number;
  repMin: number;
  repMax: number;
  incrementKg: number;
  startingWeightKg: number;
  restWorkSec: number;
}

function draftFor(exercise: Exercise): SlotDraft {
  return {
    exercise,
    ruleKind: exercise.isBodyweight ? 'manual' : 'linear',
    sets: 3,
    repTarget: 5,
    repMin: 8,
    repMax: 12,
    incrementKg: 2.5,
    startingWeightKg: exercise.isBodyweight ? 0 : 20,
    restWorkSec: 180,
  };
}

const nowIso = () => new Date().toISOString();

export function RoutineBuilder() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState<SlotDraft[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<SlotDraft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const remove = (i: number) => setDrafts((ds) => ds.filter((_, j) => j !== i));

  async function save() {
    if (!name.trim() || drafts.length === 0) return;
    setSaving(true);
    const now = nowIso();
    const program = await createProgram(name.trim(), now);
    await setActiveProgram(program.id);
    const tpl = await createTemplate(program.id, 'Day 1', 0);

    const slots: ExerciseSlot[] = drafts.map((d, order) => {
      const rule: ProgressionRule =
        d.ruleKind === 'linear'
          ? {
              kind: 'linear',
              incrementKg: d.incrementKg,
              failsBeforeDeload: 3,
              deloadPct: 0.1,
            }
          : d.ruleKind === 'double'
            ? {
                kind: 'double',
                repMin: d.repMin,
                repMax: d.repMax,
                incrementKg: d.incrementKg,
                perSet: false,
              }
            : { kind: 'manual' };
      const scheme: ExerciseSlot['scheme'] =
        d.ruleKind === 'double'
          ? { sets: d.sets, repRange: [d.repMin, d.repMax] }
          : { sets: d.sets, repTarget: d.repTarget };
      return makeSlot(d.exercise.id, order, rule, scheme, {
        warmupSec: 60,
        workSec: d.restWorkSec,
      });
    });
    tpl.slots = slots;
    await saveTemplate(tpl);

    await Promise.all(
      slots.map((slot, i) =>
        seedExerciseState(program.id, slot, drafts[i]!.startingWeightKg, now),
      ),
    );
    navigate('/today');
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-[18px] pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate('/today')} className="size-10 bg-transparent text-[22px] text-muted" aria-label="Back">
            ‹
          </button>
          <div className="text-[20px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
            New routine
          </div>
        </div>
        <button
          onClick={() => void save()}
          disabled={!name.trim() || drafts.length === 0 || saving}
          className="h-[38px] rounded-[var(--r-md)] bg-accent px-4 text-[13px] font-bold text-accent-ink disabled:opacity-40"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-8 pt-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Routine name (e.g. Upper / Lower A)"
          className="min-h-12 w-full rounded-[var(--r-md)] border bg-surface px-3.5 text-[15px] text-text placeholder:text-faint focus:outline-none"
          style={{ borderColor: 'var(--border-card)' }}
        />

        <div className="mt-3.5 flex flex-col gap-3">
          {drafts.map((d, i) => (
            <Card key={d.exercise.id + i} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-semibold text-text">
                  {d.exercise.name}
                </span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Remove exercise"
                  className="text-faint hover:text-danger"
                >
                  ✕
                </button>
              </div>

              <Segmented
                ariaLabel="Progression"
                value={d.ruleKind}
                onChange={(ruleKind) => update(i, { ruleKind })}
                options={[
                  { value: 'linear', label: 'Linear' },
                  { value: 'double', label: 'Double' },
                  { value: 'manual', label: 'Manual' },
                ]}
              />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Labeled label="Sets">
                  <Stepper
                    ariaLabel="sets"
                    value={d.sets}
                    min={1}
                    max={10}
                    onChange={(sets) => update(i, { sets })}
                  />
                </Labeled>
                {d.ruleKind === 'double' ? (
                  <>
                    <Labeled label="Rep min">
                      <Stepper
                        ariaLabel="rep min"
                        value={d.repMin}
                        min={1}
                        max={d.repMax}
                        onChange={(repMin) => update(i, { repMin })}
                      />
                    </Labeled>
                    <Labeled label="Rep max">
                      <Stepper
                        ariaLabel="rep max"
                        value={d.repMax}
                        min={d.repMin}
                        max={30}
                        onChange={(repMax) => update(i, { repMax })}
                      />
                    </Labeled>
                  </>
                ) : (
                  <Labeled label="Reps">
                    <Stepper
                      ariaLabel="reps"
                      value={d.repTarget}
                      min={1}
                      max={30}
                      onChange={(repTarget) => update(i, { repTarget })}
                    />
                  </Labeled>
                )}
                <Labeled label="Start (kg)">
                  <Stepper
                    ariaLabel="starting weight"
                    value={d.startingWeightKg}
                    min={0}
                    step={2.5}
                    onChange={(startingWeightKg) =>
                      update(i, { startingWeightKg })
                    }
                  />
                </Labeled>
                {d.ruleKind !== 'manual' && (
                  <Labeled label="+kg / step">
                    <Stepper
                      ariaLabel="increment"
                      value={d.incrementKg}
                      min={1.25}
                      step={1.25}
                      onChange={(incrementKg) => update(i, { incrementKg })}
                    />
                  </Labeled>
                )}
              </div>
            </Card>
          ))}

          <button
            onClick={() => setPicking(true)}
            className="h-12 w-full rounded-[var(--r-md)] border border-dashed text-[14px] font-semibold text-accent"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            ＋ Add exercise
          </button>
        </div>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setDrafts((ds) => [...ds, draftFor(ex)]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
