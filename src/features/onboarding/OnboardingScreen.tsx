import { useMemo, useState, type ReactNode } from 'react';
import { useNav } from '../../ui/nav';
import { Pushed } from '../../ui/Pushed';
import { useCatalog } from '../library/useCatalog';
import { generatePlan } from '../../engine';
import { useSettings } from '../../db/hooks';
import { loadStepsOf } from '../../db/repositories';
import { roundForLoad } from '../../engine/loading';
import type { LoadType } from '../../engine/types';
import { kgToLb, ftInToIn, fmtWeight } from '../../lib/units';
import type { BiologicalSex, Muscle, SplitChoice } from '../../db/types';
import { SPLITS, PRIORITY_MUSCLES } from './preferenceOptions';
import { BackButton } from '../../ui/StatGrid';
import {
  createProgramFromPlan,
  genPreferencesFrom,
  genProfileFrom,
  type OnboardingInputs,
} from './buildProgram';

/* Onboarding: five steps, one question each, options as cards with an icon tile and a
   radio dot. The goal ids are the engine's; only the labels and icons are ours. The
   preview shows every exercise with the starting weight the generator seeded from the
   lifter's body data. */

const GOALS: { id: string; label: string; sub: string; icon: ReactNode }[] = [
  {
    id: 'Build muscle',
    label: 'Build muscle',
    sub: 'Moderate reps, more volume per muscle',
    // dumbbell
    icon: <path d="M6 12h12M3 9v6M21 9v6M6 8v8M18 8v8" />,
  },
  {
    id: 'Get stronger',
    label: 'Get stronger',
    sub: 'Heavy compounds, low reps, long rest',
    // barbell with plates
    icon: <path d="M2 12h3M19 12h3M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8" />,
  },
  {
    id: 'General fitness',
    label: 'Stay fit',
    sub: 'Balanced reps, shorter sessions',
    // heart-rate line
    icon: <path d="M2 12h4l2-5 3 10 3-8 2 3h6" />,
  },
  {
    id: 'Lose fat',
    label: 'Lean out',
    sub: 'Keep strength while losing fat',
    // downward trend
    icon: <path d="M3 6l6 6 4-4 8 8M21 11v5h-5" />,
  },
  {
    id: 'Recomposition',
    label: 'Recomposition',
    sub: 'Lose fat and build muscle at once',
    // two arrows crossing
    icon: <path d="M4 6l16 12M20 14v4h-4M4 18L20 6M20 10V6h-4" />,
  },
];
const EQUIPMENT = ['Full gym', 'Home rack', 'Minimal'] as const;
const EXPERIENCE = [
  { id: 'Novice', sub: 'New to structured training' },
  { id: 'Intermediate', sub: '1 to 3 years, self-coached' },
  { id: 'Advanced', sub: 'Periodised, near my ceiling' },
] as const;
const TITLES = [
  'What are you training for?',
  'How many days a week?',
  'How long have you trained?',
  'A few numbers',
  'Your plan',
];
const SUBS = [
  'This sets your rep ranges, rest and how fast weight goes up. You can change it any time.',
  'Pick what you can keep up. Consistency beats ambition here.',
  'This sets how fast the plan progresses and how much volume it starts with.',
  'All optional. These let OpenSets suggest starting weights and a protein target.',
  '',
];
const STEPS = 5;
const nowIso = () => new Date().toISOString();

function OptionCard({
  selected,
  onClick,
  icon,
  label,
  sub,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      className={`os-card os-press flex w-full items-center gap-3.5 text-left ${selected ? 'os-card--lift os-card--selected' : ''}`}
    >
      {icon && (
        <span
          className="grid size-12 flex-none place-items-center rounded-[14px]"
          style={{ background: selected ? 'var(--acc-soft)' : 'var(--s2)' }}
          aria-hidden
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={selected ? 'var(--acc2)' : 'var(--ink2)'}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {icon}
          </svg>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className="block text-[17px] font-extrabold"
          style={{ letterSpacing: '-.02em' }}
        >
          {label}
        </span>
        {sub && <span className="os-t mt-0.5 block font-medium">{sub}</span>}
        {children}
      </span>
      <span
        className={`os-radio ${selected ? 'os-radio--on' : ''}`}
        aria-hidden
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 10.5L8 14.5L16 5.5"
              stroke="var(--acc-ink)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`os-chip os-press ${on ? 'os-chip--on' : ''}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="os-t mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
const fieldBox = 'os-card flex min-w-0 flex-1 items-center gap-2';
const fieldStyle = { padding: '12px 14px' };
const inputCls = 'os-input text-[18px] font-bold';

export function OnboardingScreen() {
  const nav = useNav();
  const catalog = useCatalog();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<string>('Build muscle');
  const [days, setDays] = useState(4);
  const [equipment, setEquipment] = useState<string>('Full gym');
  const [experience, setExperience] = useState<string>('Intermediate');
  const [splitChoice, setSplitChoice] = useState<SplitChoice>('auto');
  const [priority, setPriority] = useState<Muscle[]>([]);
  const [bodyweight, setBodyweight] = useState('');
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [dob, setDob] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightInch, setHeightInch] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [targetBodyFat, setTargetBodyFat] = useState('');
  const [timeframeWeeks, setTimeframeWeeks] = useState('');
  const [busy, setBusy] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const settings = useSettings();
  const { units, restCompoundSec, restIsolationSec } = settings;
  // The preview shows the weight the logger will prescribe: the generator's body-aware
  // start rounded to what this gym can load, the way the rules round it.
  const shownStart = (lb: number, loadType: LoadType) =>
    lb > 0
      ? roundForLoad(
          lb,
          loadType,
          settings.barLb,
          settings.plateInventoryLb,
          loadStepsOf(settings),
        )
      : 0;

  const bodyweightLb = useMemo(() => {
    const bw = parseFloat(bodyweight);
    if (Number.isNaN(bw) || bw <= 0) return undefined;
    return units === 'kg' ? kgToLb(bw) : bw;
  }, [bodyweight, units]);

  // Everything the wizard collected, in canonical units (lb, inches).
  const inputs: OnboardingInputs = useMemo(() => {
    const num = (s: string, parse: (v: string) => number) => {
      const v = parse(s);
      return Number.isNaN(v) || v <= 0 ? undefined : v;
    };
    const ft = parseInt(heightFt, 10);
    const inch = parseInt(heightInch, 10);
    const hIn = ftInToIn(
      Number.isNaN(ft) ? 0 : ft,
      Number.isNaN(inch) ? 0 : inch,
    );
    return {
      goal,
      experience,
      days,
      equipment,
      splitChoice,
      priorityMuscles: priority,
      ...(sex ? { sex } : {}),
      ...(dob ? { birthDate: dob } : {}),
      ...(bodyweightLb ? { bodyweightLb } : {}),
      ...(hIn > 0 ? { heightIn: hIn } : {}),
      ...(num(bodyFat, parseFloat)
        ? { bodyFatPct: num(bodyFat, parseFloat) }
        : {}),
      ...(num(targetBodyFat, parseFloat)
        ? { targetBodyFatPct: num(targetBodyFat, parseFloat) }
        : {}),
      ...(num(timeframeWeeks, (v) => parseInt(v, 10))
        ? { goalTimeframeWeeks: num(timeframeWeeks, (v) => parseInt(v, 10)) }
        : {}),
    };
  }, [
    goal,
    experience,
    days,
    equipment,
    splitChoice,
    priority,
    sex,
    dob,
    bodyweightLb,
    heightFt,
    heightInch,
    bodyFat,
    targetBodyFat,
    timeframeWeeks,
  ]);

  // The generated plan, recomputed as the answers change, used for the preview and the
  // build so they always agree.
  const plan = useMemo(
    () =>
      catalog
        ? generatePlan(catalog, genProfileFrom(inputs, nowIso()), {
            ...genPreferencesFrom(inputs),
            rest: {
              compoundSec: restCompoundSec,
              isolationSec: restIsolationSec,
            },
          })
        : null,
    [catalog, inputs, restCompoundSec, restIsolationSec],
  );

  async function finish() {
    if (!plan || busy) return;
    setBusy(true);
    setBuildError(null);
    try {
      await createProgramFromPlan(plan, inputs, nowIso());
    } catch {
      setBusy(false);
      setBuildError(
        'Could not save your plan. Nothing was changed. Try again.',
      );
      return;
    }
    try {
      localStorage.setItem('opensets-onboarded', '1');
    } catch {
      /* ignore */
    }
    nav.pop('/today');
  }

  const next = () =>
    step >= STEPS - 1 ? void finish() : setStep((s) => s + 1);
  const back = () => (step === 0 ? nav.pop() : setStep((s) => s - 1));
  const bodyDataGiven = Boolean(bodyweightLb || sex);

  return (
    <Pushed to={-1}>
      <div className="relative flex h-full flex-col">
        <div className="flex-1 overflow-auto px-[18px] pb-[120px] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <BackButton onClick={back} />
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-[3px]"
              style={{ background: 'var(--s2)' }}
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={STEPS}
              aria-valuenow={step + 1}
              aria-label="Onboarding progress"
            >
              <div
                className="h-full rounded-[3px] transition-[width]"
                style={{
                  width: `${((step + 1) / STEPS) * 100}%`,
                  background: 'linear-gradient(90deg, var(--acc2), var(--acc))',
                }}
              />
            </div>
            <span
              className="os-t"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {step + 1} of {STEPS}
            </span>
          </div>

          <h1
            className="os-h1 mt-[26px]"
            style={{ fontSize: 30, lineHeight: 1.1 }}
          >
            {step === STEPS - 1
              ? `${GOALS.find((g) => g.id === goal)?.label ?? goal} · ${days} days`
              : TITLES[step]}
          </h1>
          {SUBS[step] && (
            <p className="os-t mt-2 font-medium leading-[1.4]">{SUBS[step]}</p>
          )}
          {step === STEPS - 1 && (
            <p className="os-t mt-2 font-medium leading-[1.4]">
              {goal === 'Get stronger' || experience === 'Novice'
                ? 'Linear'
                : 'Double'}{' '}
              progression · {equipment.toLowerCase()} · built for{' '}
              {experience.toLowerCase()} lifters.
            </p>
          )}

          {step === 0 && (
            <div
              className="mt-[22px] flex flex-col gap-2.5"
              role="radiogroup"
              aria-label="Goal"
            >
              {GOALS.map((g) => (
                <OptionCard
                  key={g.id}
                  selected={goal === g.id}
                  onClick={() => setGoal(g.id)}
                  icon={g.icon}
                  label={g.label}
                  sub={g.sub}
                />
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              <div
                className="mt-5 grid grid-cols-4 gap-2"
                role="radiogroup"
                aria-label="Days per week"
              >
                {[3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={days === d}
                    onClick={() => setDays(d)}
                    className={`os-card os-press os-num aspect-square text-[26px] ${days === d ? 'os-card--lift os-card--selected' : ''}`}
                    style={{
                      padding: 0,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="os-h2">Equipment</div>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT.map((e) => (
                  <Chip
                    key={e}
                    on={equipment === e}
                    onClick={() => setEquipment(e)}
                  >
                    {e}
                  </Chip>
                ))}
              </div>
              <div className="os-h2">
                Split <span>optional</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SPLITS.map((s) => (
                  <Chip
                    key={s.id}
                    on={splitChoice === s.id}
                    onClick={() => setSplitChoice(s.id)}
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <div
              className="mt-[22px] flex flex-col gap-2.5"
              role="radiogroup"
              aria-label="Experience"
            >
              {EXPERIENCE.map((x) => (
                <OptionCard
                  key={x.id}
                  selected={experience === x.id}
                  onClick={() => setExperience(x.id)}
                  label={x.id}
                  sub={x.sub}
                />
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="mt-5 flex flex-col gap-3.5">
              <Field label="Sex">
                <div
                  className="grid grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label="Sex"
                >
                  {(['male', 'female'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={sex === s}
                      onClick={() => setSex((cur) => (cur === s ? null : s))}
                      className={`os-btn os-btn--sm os-press capitalize ${sex === s ? 'os-btn--ink' : ''}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Date of birth">
                <div className={fieldBox} style={fieldStyle}>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    aria-label="Date of birth"
                    className={inputCls}
                    style={{ fontSize: 16 }}
                  />
                </div>
              </Field>
              <Field label="Height">
                <div className="flex gap-2">
                  <div className={fieldBox} style={fieldStyle}>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={heightFt}
                      onChange={(e) => setHeightFt(e.target.value)}
                      placeholder="0"
                      aria-label="Height feet"
                      className={inputCls}
                    />
                    <span className="os-t">ft</span>
                  </div>
                  <div className={fieldBox} style={fieldStyle}>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={heightInch}
                      onChange={(e) => setHeightInch(e.target.value)}
                      placeholder="0"
                      aria-label="Height inches"
                      className={inputCls}
                    />
                    <span className="os-t">in</span>
                  </div>
                </div>
              </Field>
              <Field label="Bodyweight">
                <div className={fieldBox} style={fieldStyle}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={bodyweight}
                    onChange={(e) => setBodyweight(e.target.value)}
                    placeholder="0"
                    aria-label="Bodyweight"
                    className={inputCls}
                  />
                  <span className="os-t">{units}</span>
                </div>
              </Field>
              <Field label="Body fat percent">
                <div className={fieldBox} style={fieldStyle}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value)}
                    placeholder="0"
                    aria-label="Body fat percent"
                    className={inputCls}
                  />
                  <span className="os-t">%</span>
                </div>
              </Field>
              <div>
                <div className="os-h2" style={{ marginTop: 6 }}>
                  Goal target <span>optional</span>
                </div>
                <p className="os-t mb-2 leading-snug">
                  For a physique target, such as 12 percent body fat in 8 weeks.
                </p>
                <div className="flex gap-2">
                  <div className={fieldBox} style={fieldStyle}>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={targetBodyFat}
                      onChange={(e) => setTargetBodyFat(e.target.value)}
                      placeholder="0"
                      aria-label="Target body fat percent"
                      className={inputCls}
                    />
                    <span className="os-t">% fat</span>
                  </div>
                  <div className={fieldBox} style={fieldStyle}>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={timeframeWeeks}
                      onChange={(e) => setTimeframeWeeks(e.target.value)}
                      placeholder="0"
                      aria-label="Goal timeframe weeks"
                      className={inputCls}
                    />
                    <span className="os-t">weeks</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="os-h2" style={{ marginTop: 6 }}>
                  Priority muscles <span>optional</span>
                </div>
                <p className="os-t mb-2 leading-snug">
                  Lagging areas to bias extra volume toward.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITY_MUSCLES.map((m) => (
                    <Chip
                      key={m.id}
                      on={priority.includes(m.id)}
                      onClick={() =>
                        setPriority((cur) =>
                          cur.includes(m.id)
                            ? cur.filter((x) => x !== m.id)
                            : [...cur, m.id],
                        )
                      }
                    >
                      {m.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mt-4 flex flex-col gap-2.5">
              {(plan?.program.days ?? []).map((day) => (
                <div
                  key={day.name}
                  className="os-card"
                  style={{ padding: '10px 16px 6px' }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[16px] font-extrabold"
                      style={{ letterSpacing: '-.02em' }}
                    >
                      {day.name}
                    </span>
                    <span className="os-t">{day.slots.length} exercises</span>
                  </div>
                  <div className="mt-1">
                    {day.slots.map((s, i) => (
                      <div
                        key={s.exerciseId}
                        className="os-row"
                        style={{ padding: '9px 0' }}
                      >
                        <span
                          className="os-t w-4"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                          {s.exerciseName}
                        </span>
                        <span
                          className="os-t"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {s.scheme.sets}×
                          {s.scheme.repTarget ??
                            `${s.scheme.repRange?.[0]}–${s.scheme.repRange?.[1]}`}
                        </span>
                        <span
                          className="os-num w-14 text-right text-[15px]"
                          style={{ letterSpacing: '-.02em' }}
                        >
                          {shownStart(s.startWeightLb, s.loadType) > 0
                            ? fmtWeight(
                                shownStart(s.startWeightLb, s.loadType),
                                units,
                              )
                            : 'BW'}
                          {shownStart(s.startWeightLb, s.loadType) > 0 && (
                            <small className="os-t ml-0.5 text-[11px]">
                              {units}
                            </small>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="os-t px-1 leading-snug">
                {bodyDataGiven
                  ? 'Suggested from your body data, fine-tune in your first session.'
                  : 'Starting weights are conservative. Fine-tune them in your first session.'}
              </p>
              {!catalog && (
                <p className="os-t text-center">
                  Loading the exercise library…
                </p>
              )}
            </div>
          )}
        </div>

        <div className="os-dock">
          {buildError && (
            <p
              role="alert"
              className="mb-2.5 text-center text-[13px] font-semibold"
              style={{ color: 'var(--danger)' }}
            >
              {buildError}
            </p>
          )}
          <button
            type="button"
            onClick={next}
            disabled={busy || (step === STEPS - 1 && !plan)}
            className="os-btn os-btn--pri os-press"
          >
            {busy
              ? 'Building…'
              : step === STEPS - 1
                ? 'Build my plan'
                : 'Continue'}
          </button>
        </div>
      </div>
    </Pushed>
  );
}
