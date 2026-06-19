import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, Section } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
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
    <Screen title="New routine">
      <Section>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Routine name (e.g. Upper / Lower A)"
          className="min-h-12 w-full rounded-lg border border-border bg-surface-2 px-3 text-[15px] text-text placeholder:text-faint focus:border-border-strong focus:outline-none"
        />
      </Section>

      <Section title={`Exercises${drafts.length ? ` (${drafts.length})` : ''}`}>
        <div className="flex flex-col gap-3">
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

          <Button variant="secondary" block onClick={() => setPicking(true)}>
            + Add exercise
          </Button>
        </div>
      </Section>

      <Button
        block
        disabled={!name.trim() || drafts.length === 0 || saving}
        onClick={() => void save()}
      >
        {saving ? 'Saving…' : 'Save routine'}
      </Button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setDrafts((ds) => [...ds, draftFor(ex)]);
            setPicking(false);
          }}
        />
      )}
    </Screen>
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
