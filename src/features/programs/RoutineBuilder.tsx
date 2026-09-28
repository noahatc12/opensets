import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useNav } from '../../ui/nav';
import { Pushed } from '../../ui/Pushed';
import { PlanScreen } from './PlanScreen';
import { TabBar } from '../../components/TabBar';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProfile, useSettings } from '../../db/hooks';
import { startingWeightLb } from '../../engine/body';
import { ageFromBirthDate } from '../../lib/age';
import { displayWeight, kgToLb } from '../../lib/units';
import { clock, titleCase } from '../../lib/format';
import { ExercisePicker } from '../library/ExercisePicker';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { BackButton } from '../../ui/StatGrid';
import type { Exercise, ExerciseSlot } from '../../db/types';
import { db } from '../../db/db';
import type { ProgressionRule } from '../../engine/types';
import { loadTypeFor, roundForLoad } from '../../engine/loading';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
  latestBodyweightLb,
  loadStepsOf,
  getExerciseState,
  represcribeAfterEdit,
  getActiveProgram,
  listTemplates,
} from '../../db/repositories';

/* The routine builder. At /routine/new it adds a day, named as typed, to the active program
   (or starts "My plan" when there is none: "+ New day" used to start a separate program and
   hide the first, so a split could not be built by hand, persona check 09-28); at
   /routine/<day id> it edits a day that already exists (Noah, 09-28: "I couldn't go back
   and change how many sets"). The title is the 32px heading itself, typed in place; each
   exercise is a card with mini steppers; the day is saved from the button at the bottom.
   Reordering is by the up and down arrows on each card: pointer drag on a scrolling phone
   page needs a gesture layer this build does not have, and arrows are exact.

   Editing keeps history: sessions freeze their own copy of the slots, and an exercise
   whose sets, reps, rule or weight changed is re-prescribed from its current state
   (represcribeAfterEdit), keeping the miss count unless the rule or weight changed.
   Exercises whose progression the builder cannot express (5/3/1, GZCLP, APRE and the
   like, from generated programs) keep their rule; only rest, order and removal edit. */

type RuleKind = 'linear' | 'double' | 'manual';

interface SlotDraft {
  exercise: Exercise;
  /** The saved slot this card edits; absent for a newly added exercise. */
  slot?: ExerciseSlot;
  /** The working weight when the editor opened, to tell whether it was changed. */
  origWeightLb?: number;
  /** The slot's rule is one the builder cannot edit (5/3/1, GZCLP, ...). */
  locked?: boolean;
  ruleKind: RuleKind;
  sets: number;
  repTarget: number;
  repMin: number;
  repMax: number;
  incrementLb: number;
  startingWeightLb: number;
  restWorkSec: number;
}

function draftFor(exercise: Exercise, startingWeightLb: number): SlotDraft {
  return {
    exercise,
    ruleKind: exercise.isBodyweight ? 'manual' : 'linear',
    sets: 3,
    repTarget: 5,
    repMin: 8,
    repMax: 12,
    incrementLb: 2.5,
    startingWeightLb,
    restWorkSec: 180,
  };
}

const RULE_NAMES: Record<string, string> = {
  percent531: '5/3/1',
  gzclp: 'GZCLP',
  rpeTarget: 'RPE target',
  apre: 'APRE',
  repsOnly: 'Reps only',
  durationLinear: 'Timed',
};

/** A card from a saved slot and the exercise's current working weight. */
function draftFromSlot(
  slot: ExerciseSlot,
  exercise: Exercise,
  weightLb: number,
): SlotDraft {
  const r = slot.progressionRule;
  const kind: RuleKind | null =
    r.kind === 'linear' || r.kind === 'double' || r.kind === 'manual'
      ? r.kind
      : null;
  return {
    exercise,
    slot,
    origWeightLb: weightLb,
    locked: kind === null,
    ruleKind: kind ?? 'manual',
    sets: slot.scheme.sets,
    repTarget: slot.scheme.repTarget ?? slot.scheme.repRange?.[0] ?? 5,
    repMin: r.kind === 'double' ? r.repMin : (slot.scheme.repRange?.[0] ?? 8),
    repMax: r.kind === 'double' ? r.repMax : (slot.scheme.repRange?.[1] ?? 12),
    incrementLb: 'incrementLb' in r ? r.incrementLb : 2.5,
    startingWeightLb: weightLb,
    restWorkSec: slot.restWorkSec,
  };
}

/** The progression rule a card describes (a saved linear rule keeps its deload terms). */
function ruleFor(d: SlotDraft): ProgressionRule {
  const prev = d.slot?.progressionRule;
  if (d.ruleKind === 'linear')
    return {
      kind: 'linear',
      incrementLb: d.incrementLb,
      failsBeforeDeload: prev?.kind === 'linear' ? prev.failsBeforeDeload : 3,
      deloadPct: prev?.kind === 'linear' ? prev.deloadPct : 0.1,
    };
  if (d.ruleKind === 'double')
    return {
      kind: 'double',
      repMin: d.repMin,
      repMax: d.repMax,
      incrementLb: d.incrementLb,
      perSet: prev?.kind === 'double' ? prev.perSet : false,
    };
  return { kind: 'manual' };
}

function schemeFor(d: SlotDraft): ExerciseSlot['scheme'] {
  return d.ruleKind === 'double'
    ? { sets: d.sets, repRange: [d.repMin, d.repMax] }
    : { sets: d.sets, repTarget: d.repTarget };
}

const nowIso = () => new Date().toISOString();

export function RoutineBuilder() {
  const nav = useNav();
  const location = useLocation();
  const { templateId } = useParams();
  const editing = Boolean(templateId);
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState<SlotDraft[]>([]);
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const catalog = useCatalog();
  // Edit mode: the saved day, its program, and each exercise's working weight.
  const editSource = useLiveQuery(async () => {
    if (!templateId) return null;
    const tpl = await db.templates.get(templateId);
    if (!tpl) return null;
    const program = await db.programs.get(tpl.programId);
    const weights = await Promise.all(
      tpl.slots.map(
        async (s) =>
          (await getExerciseState(tpl.programId, s.exerciseId))
            ?.workingWeightLb ?? 0,
      ),
    );
    return { tpl, programName: program?.name ?? '', weights };
  }, [templateId]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (editing && editSource && catalog && loadedFor !== editSource.tpl.id) {
    setLoadedFor(editSource.tpl.id);
    setName(editSource.tpl.name);
    setDrafts(
      editSource.tpl.slots
        .map((s, i) => ({ s, w: editSource.weights[i] ?? 0 }))
        .sort((a, b) => a.s.order - b.s.order)
        .flatMap(({ s, w }) => {
          const ex = getCatalogExercise(s.exerciseId);
          return ex ? [draftFromSlot(s, ex, w)] : [];
        }),
    );
  }
  // New-day mode adds to the active program; its days number the new one, and its lifts'
  // working weights prefill any exercise it already trains (their progress is kept).
  const active = useLiveQuery(async () => {
    if (editing) return null;
    const program = await getActiveProgram();
    if (!program) return null;
    const days = await listTemplates(program.id);
    const states = await db.exerciseState
      .filter((r) => r.programId === program.id)
      .toArray();
    return {
      program,
      dayCount: days.length,
      weightOf: new Map(states.map((r) => [r.exerciseId, r.workingWeightLb])),
    };
  }, [editing]);
  const settings = useSettings();
  const profile = useProfile();
  const bodyweightLb = useLiveQuery(() => latestBodyweightLb());

  /** A cautious body-aware start for a newly added exercise, rounded to what this
   *  gym can load (the lifter can still edit it before saving). */
  function suggestedStartLb(exercise: Exercise): number {
    const loadType = loadTypeFor(exercise.equipment, exercise.isBodyweight);
    const raw = startingWeightLb({
      loadType,
      compound: exercise.mechanic === 'compound',
      bodyweightLb,
      sex: profile?.sex,
      ageYears: ageFromBirthDate(profile?.birthDate, nowIso()),
      experience: profile?.experience,
    });
    return roundForLoad(
      raw,
      loadType,
      settings.barLb,
      settings.plateInventoryLb,
      loadStepsOf(settings),
    );
  }
  // Exercise detail's "Add to a day" hands the exercise over in router state; it becomes
  // the first card once the catalog is here.
  const addId = (location.state as { addExerciseId?: string } | null)
    ?.addExerciseId;
  const addEx = addId ? getCatalogExercise(addId) : undefined;
  /** A new card. A lift the program already trains starts from its working weight and
   *  remembers it, so saving leaves its progress alone unless the weight was changed. */
  const draftStart = (ex: Exercise): SlotDraft => {
    const prior = active?.weightOf.get(ex.id);
    return prior === undefined
      ? draftFor(ex, suggestedStartLb(ex))
      : { ...draftFor(ex, prior), origWeightLb: prior };
  };
  // Wait for the active program to load (undefined), or the card would miss its weight.
  if (
    addEx &&
    active !== undefined &&
    seededFrom !== addEx.id &&
    drafts.length === 0
  ) {
    setSeededFrom(addEx.id);
    setDrafts([draftStart(addEx)]);
  }
  const shown = (lb: number) => displayWeight(lb, settings.units);
  const fromShown = (v: number) => (settings.units === 'kg' ? kgToLb(v) : v);

  const update = (i: number, patch: Partial<SlotDraft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const remove = (i: number) => setDrafts((ds) => ds.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) =>
    setDrafts((ds) => {
      const j = i + dir;
      if (j < 0 || j >= ds.length) return ds;
      const next = ds.slice();
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const est = Math.round(
    drafts.reduce((m, d) => m + d.sets * (d.restWorkSec + 35), 0) / 60,
  );
  const canSave = name.trim().length > 0 && drafts.length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    if (editing) return saveEdit();
    setSaving(true);
    const now = nowIso();
    // Re-read at save time: the live query may not have landed on a fast save.
    const existing = await getActiveProgram();
    const program = existing ?? (await createProgram('My plan', now));
    if (!existing) await setActiveProgram(program.id);
    const dayIndex = existing ? (await listTemplates(program.id)).length : 0;
    const tpl = await createTemplate(program.id, name.trim(), dayIndex);

    const slots: ExerciseSlot[] = drafts.map((d, order) =>
      makeSlot(
        d.exercise.id,
        order,
        ruleFor(d),
        schemeFor(d),
        { warmupSec: 60, workSec: d.restWorkSec },
        {
          loadType: loadTypeFor(d.exercise.equipment, d.exercise.isBodyweight),
        },
      ),
    );
    tpl.slots = slots;
    await saveTemplate(tpl);
    // Progress is kept per program and exercise, so a lift another day already trains
    // keeps its state; it starts clean only if its weight was changed here.
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      const d = drafts[i]!;
      const prior = await getExerciseState(program.id, slot.exerciseId);
      if (!prior)
        await seedExerciseState(program.id, slot, d.startingWeightLb, now);
      else if (
        d.origWeightLb !== undefined &&
        Math.abs(d.startingWeightLb - d.origWeightLb) > 0.001
      )
        await represcribeAfterEdit(
          program.id,
          slot,
          d.startingWeightLb,
          false,
          now,
        );
    }
    nav.pop(existing ? '/plan' : '/today');
  }

  /** Save an edited day in place: same day id, same program, history untouched. */
  async function saveEdit() {
    const source = editSource;
    if (!source) return;
    setSaving(true);
    const now = nowIso();
    const programId = source.tpl.programId;
    const slots: ExerciseSlot[] = drafts.map((d, order) => {
      if (d.slot && d.locked)
        return { ...d.slot, order, restWorkSec: d.restWorkSec };
      if (d.slot)
        return {
          ...d.slot,
          order,
          progressionRule: ruleFor(d),
          scheme: schemeFor(d),
          restWorkSec: d.restWorkSec,
        };
      return makeSlot(
        d.exercise.id,
        order,
        ruleFor(d),
        schemeFor(d),
        { warmupSec: 60, workSec: d.restWorkSec },
        {
          loadType: loadTypeFor(d.exercise.equipment, d.exercise.isBodyweight),
        },
      );
    });
    await saveTemplate({
      ...source.tpl,
      name: name.trim() || source.tpl.name,
      slots,
    });
    for (let i = 0; i < slots.length; i++) {
      const d = drafts[i]!;
      const slot = slots[i]!;
      if (d.locked) continue;
      const weightChanged =
        d.origWeightLb === undefined ||
        Math.abs(d.startingWeightLb - d.origWeightLb) > 0.001;
      const ruleChanged =
        !d.slot || d.slot.progressionRule.kind !== slot.progressionRule.kind;
      const changed =
        !d.slot ||
        weightChanged ||
        JSON.stringify(d.slot.progressionRule) !==
          JSON.stringify(slot.progressionRule) ||
        JSON.stringify(d.slot.scheme) !== JSON.stringify(slot.scheme);
      if (changed)
        await represcribeAfterEdit(
          programId,
          slot,
          d.startingWeightLb,
          !ruleChanged && !weightChanged,
          now,
        );
    }
    nav.pop('/plan');
  }

  return (
    <Pushed
      to="/plan"
      parent={
        <>
          <PlanScreen />
          <TabBar activePath="/plan" />
        </>
      }
    >
      <div className="relative flex h-full flex-col">
        <div className="flex-1 overflow-auto px-[18px] pb-[120px] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <BackButton onClick={() => nav.pop('/plan')} />
          <div className="os-t mt-3.5">
            {editing
              ? editSource?.programName || 'Edit day'
              : active
                ? `${active.program.name} · Day ${active.dayCount + 1}`
                : 'Day 1'}{' '}
            · {drafts.length} {drafts.length === 1 ? 'exercise' : 'exercises'}
            {drafts.length > 0 && ` · ${est} min`}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this day"
            aria-label="Day name"
            className="os-input mt-0.5 w-full"
            style={{
              padding: 0,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-.035em',
              lineHeight: 1.05,
            }}
          />

          <div className="mt-3.5 flex flex-col gap-2">
            {drafts.map((d, i) => (
              <div
                key={d.exercise.id + i}
                className="os-card"
                style={{ padding: '12px 12px 12px 14px' }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="os-num w-[22px] text-[20px]"
                    style={{ color: 'var(--faint)' }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-extrabold leading-tight">
                      {d.exercise.name}
                    </div>
                    <div className="os-t truncate text-[12px]">
                      {[
                        titleCase(d.exercise.primaryMuscles[0]),
                        titleCase(d.exercise.equipment),
                        `rest ${clock(d.restWorkSec)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="os-icon-btn os-press"
                      style={{ width: 32, height: 32, borderRadius: 10 }}
                      aria-label={`Move ${d.exercise.name} up`}
                    >
                      <Chevron up />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === drafts.length - 1}
                      className="os-icon-btn os-press"
                      style={{ width: 32, height: 32, borderRadius: 10 }}
                      aria-label={`Move ${d.exercise.name} down`}
                    >
                      <Chevron />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="os-icon-btn os-press"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        color: 'var(--mute)',
                      }}
                      aria-label={`Remove ${d.exercise.name}`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </div>

                {d.locked ? (
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <p className="os-t min-w-0 flex-1 leading-snug">
                      {RULE_NAMES[d.slot!.progressionRule.kind] ?? 'Program'}{' '}
                      progression, set by your program. Rest can change here.
                    </p>
                    <div className="w-[120px] flex-none">
                      <Mini
                        label="Rest · sec"
                        value={d.restWorkSec}
                        onChange={(v) => update(i, { restWorkSec: v })}
                        min={30}
                        max={600}
                        step={15}
                        name="rest"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="os-seg mt-2.5"
                      role="radiogroup"
                      aria-label="Progression"
                      style={{ background: 'var(--s2)' }}
                    >
                      {(['linear', 'double', 'manual'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={d.ruleKind === k}
                          onClick={() => update(i, { ruleKind: k })}
                        >
                          {k === 'linear'
                            ? 'Linear'
                            : k === 'double'
                              ? 'Double'
                              : 'Manual'}
                        </button>
                      ))}
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                      <Mini
                        label="Sets"
                        value={d.sets}
                        onChange={(v) => update(i, { sets: v })}
                        min={1}
                        max={10}
                        name="sets"
                      />
                      {d.ruleKind === 'double' ? (
                        <>
                          <Mini
                            label="Reps from"
                            value={d.repMin}
                            onChange={(v) => update(i, { repMin: v })}
                            min={1}
                            max={d.repMax}
                            name="rep min"
                          />
                          <Mini
                            label="Reps to"
                            value={d.repMax}
                            onChange={(v) => update(i, { repMax: v })}
                            min={d.repMin}
                            max={30}
                            name="rep max"
                          />
                        </>
                      ) : (
                        <Mini
                          label="Reps"
                          value={d.repTarget}
                          onChange={(v) => update(i, { repTarget: v })}
                          min={1}
                          max={30}
                          name="reps"
                        />
                      )}
                      <Mini
                        label={`${editing && d.slot ? 'Weight' : 'Start'} · ${settings.units}`}
                        value={shown(d.startingWeightLb)}
                        onChange={(v) =>
                          update(i, { startingWeightLb: fromShown(v) })
                        }
                        min={0}
                        step={settings.units === 'kg' ? 1 : 2.5}
                        name="starting weight"
                      />
                      {d.ruleKind !== 'manual' && (
                        <Mini
                          label={`Step · ${settings.units}`}
                          value={shown(d.incrementLb)}
                          onChange={(v) =>
                            update(i, { incrementLb: fromShown(v) })
                          }
                          min={settings.units === 'kg' ? 0.5 : 1.25}
                          step={settings.units === 'kg' ? 0.5 : 1.25}
                          name="increment"
                        />
                      )}
                      <Mini
                        label="Rest · sec"
                        value={d.restWorkSec}
                        onChange={(v) => update(i, { restWorkSec: v })}
                        min={30}
                        max={600}
                        step={15}
                        name="rest"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setPicking(true)}
              className="os-btn os-press"
              style={{
                background: 'transparent',
                boxShadow: 'inset 0 0 0 1.5px var(--s3)',
                color: 'var(--ink2)',
              }}
            >
              + Add exercise
            </button>
          </div>
        </div>

        <div className="os-dock">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className="os-btn os-btn--pri os-press"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save day'}
          </button>
        </div>

        {picking && (
          <ExercisePicker
            onClose={() => setPicking(false)}
            onPick={(ex) => {
              setDrafts((ds) => [...ds, draftStart(ex)]);
              setPicking(false);
            }}
          />
        )}
      </div>
    </Pushed>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A mini stepper tile: label, numeral, minus and plus. */
function Mini({
  label,
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  name,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  name: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, round2(v))));
  return (
    <div
      className="rounded-[14px] px-1.5 py-2 text-center"
      style={{ background: 'var(--s2)', boxShadow: 'inset 0 1px 0 var(--hl)' }}
    >
      <div className="os-t truncate text-[11px]">{label}</div>
      <div className="os-num my-1 text-[22px]">
        {Number.isInteger(value) ? value : round2(value)}
      </div>
      <div className="flex justify-center gap-1.5">
        <button
          type="button"
          onClick={() => set(value - step)}
          disabled={value <= min}
          className="os-step os-step--sm os-press"
          aria-label={`Decrease ${name}`}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => set(value + step)}
          disabled={value >= max}
          className="os-step os-step--sm os-press"
          aria-label={`Increase ${name}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}
