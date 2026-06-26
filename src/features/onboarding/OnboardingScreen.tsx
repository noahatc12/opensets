import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../library/useCatalog';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
} from '../../db/repositories';
import {
  generatePlan,
  type Goal,
  type Equipment,
  type Experience,
} from './generator';
import { ChevronLeftIcon } from '../../components/icons';
import { db } from '../../db/db';
import { newId } from '../../db/ids';
import { useSettings, updateProfile } from '../../db/hooks';
import { kgToLb, ftInToIn } from '../../lib/units';
import type { BiologicalSex, Profile } from '../../db/types';

/* Ported from the Tempo prototype onboarding wizard (6 steps). On finish it
   generates a simple starter routine from the chosen goal/experience. */

const GOALS = ['Build muscle', 'Lose fat', 'Recomposition', 'Get stronger'] as const;
const EQUIPMENT = ['Full gym', 'Home rack', 'Minimal'] as const;
const EXPERIENCE = [
  { id: 'Novice', sub: 'New to structured training' },
  { id: 'Intermediate', sub: '1–3 years, self-coached' },
  { id: 'Advanced', sub: 'Periodised, near my ceiling' },
] as const;
const CTAS = ['Get started', 'Continue', 'Continue', 'Continue', 'Continue', 'Build my plan'];

const nowIso = () => new Date().toISOString();

const cardSel = (active: boolean) =>
  active
    ? { background: 'var(--accent)', color: 'var(--accent-ink)' as const, border: '1px solid transparent' }
    : { background: 'var(--surface)', color: 'var(--text)' as const, border: '1px solid var(--border-card)' };

export function OnboardingScreen() {
  const navigate = useNavigate();
  const catalog = useCatalog();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<string>('Build muscle');
  const [days, setDays] = useState(4);
  const [equipment, setEquipment] = useState<string>('Full gym');
  const [experience, setExperience] = useState<string>('Intermediate');
  const [bodyweight, setBodyweight] = useState('');
  // Profile capture (all optional — the wizard is skippable). Height is canonical
  // inches; entered as ft + in. Persisted to db.profile on finish (§6.6 input).
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [dob, setDob] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightInch, setHeightInch] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [targetBodyFat, setTargetBodyFat] = useState('');
  const [timeframeWeeks, setTimeframeWeeks] = useState('');
  const [busy, setBusy] = useState(false);
  const { units, restCompoundSec, restIsolationSec } = useSettings();

  // The generated plan — recomputed as the answers change, used for both the
  // step-5 preview and the actual build so they always agree.
  const plan = useMemo(
    () =>
      catalog
        ? generatePlan(catalog, {
            goal: goal as Goal,
            days,
            equipment: equipment as Equipment,
            experience: experience as Experience,
            rest: { compoundSec: restCompoundSec, isolationSec: restIsolationSec },
          })
        : null,
    [catalog, goal, days, equipment, experience, restCompoundSec, restIsolationSec],
  );

  async function finish() {
    if (!plan) return;
    setBusy(true);
    const now = nowIso();
    const program = await createProgram(plan.programName, now);
    await setActiveProgram(program.id);

    for (let di = 0; di < plan.days.length; di++) {
      const day = plan.days[di]!;
      const tpl = await createTemplate(program.id, day.name, di);
      const slots = day.slots.map((sp, i) =>
        makeSlot(sp.exerciseId, i, sp.rule, sp.scheme, sp.rest),
      );
      tpl.slots = slots;
      await saveTemplate(tpl);
      await Promise.all(
        slots.map((slot, i) =>
          seedExerciseState(program.id, slot, day.slots[i]!.startWeightLb, now),
        ),
      );
    }

    const bw = parseFloat(bodyweight);
    if (!Number.isNaN(bw) && bw > 0) {
      await db.measurements.add({
        id: newId(),
        type: 'bodyweight',
        date: now,
        valueLb: units === 'kg' ? kgToLb(bw) : bw,
      });
    }

    // Persist the captured profile (always carries the chosen goal; numbers are
    // optional). Height stored canonical in inches. Bodyweight stays a measurement.
    const profile: Partial<Profile> = { goal };
    if (sex) profile.sex = sex;
    if (dob) profile.birthDate = dob;
    const ft = parseInt(heightFt, 10);
    const inch = parseInt(heightInch, 10);
    const hIn = ftInToIn(Number.isNaN(ft) ? 0 : ft, Number.isNaN(inch) ? 0 : inch);
    if (hIn > 0) profile.heightIn = hIn;
    const bf = parseFloat(bodyFat);
    if (!Number.isNaN(bf) && bf > 0) profile.bodyFatPct = bf;
    const tbf = parseFloat(targetBodyFat);
    if (!Number.isNaN(tbf) && tbf > 0) profile.targetBodyFatPct = tbf;
    const wk = parseInt(timeframeWeeks, 10);
    if (!Number.isNaN(wk) && wk > 0) profile.goalTimeframeWeeks = wk;
    await updateProfile(profile);

    try {
      localStorage.setItem('opensets-onboarded', '1');
    } catch {
      /* ignore */
    }
    navigate('/today');
  }

  function next() {
    if (step >= 5) {
      void finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3.5 px-[22px] pb-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button
          onClick={() => (step === 0 ? navigate('/today') : setStep((s) => s - 1))}
          className="grid size-[38px] place-items-center bg-transparent text-muted"
          aria-label="Back"
        >
          <ChevronLeftIcon className="size-[22px]" />
        </button>
        <div className="h-[5px] flex-1 overflow-hidden rounded-[3px]" style={{ background: 'var(--surface-2)' }}>
          <div
            className="h-full rounded-[3px] transition-[width]"
            style={{ background: 'var(--accent)', width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[26px] pb-2 pt-2.5">
        {step === 0 && (
          <div className="pt-[30px]">
            <div className="mb-6 grid size-14 place-items-center rounded-[var(--r-lg)] text-accent-ink" style={{ background: 'var(--accent)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h16M7 8v8M17 8v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-[32px] font-bold leading-[1.1] text-text" style={{ letterSpacing: 'var(--tracking-tight)' }}>
              Your coach is just math.
            </div>
            <p className="mt-3.5 text-[15px] leading-relaxed text-muted">
              OpenSets builds your plan, tracks every set, and tells you exactly when to
              add weight — on-device, free, fully usable with no signal.
            </p>
            <div
              className="mt-6 rounded-[var(--r-md)] border p-4 text-[12px] leading-relaxed text-muted"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
            >
              Educational tool — <span className="font-semibold text-text">not medical advice.</span> Train within your own limits.
            </div>
          </div>
        )}

        {step === 1 && (
          <Step n="Step 1" title="What's your goal?">
            <div className="mt-[22px] flex flex-col gap-2.5">
              {GOALS.map((g) => (
                <button key={g} onClick={() => setGoal(g)} className="rounded-[var(--r-md)] px-[18px] py-4 text-left text-[15px] font-bold" style={cardSel(goal === g)}>
                  {g}
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step n="Step 2" title="Days per week">
            <div className="mt-5 flex gap-2.5">
              {[3, 4, 5, 6].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className="flex aspect-square flex-1 items-center justify-center rounded-[var(--r-md)] text-[22px] font-bold"
                  style={{ ...cardSel(days === d), fontFamily: 'var(--font-num)' }}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mb-3.5 mt-[26px] text-[15px] font-semibold text-text">Equipment</div>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map((e) => (
                <button key={e} onClick={() => setEquipment(e)} className="rounded-[var(--r-pill)] px-4 py-2.5 text-[13px] font-semibold" style={cardSel(equipment === e)}>
                  {e}
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step n="Step 3" title="Experience">
            <div className="mt-[22px] flex flex-col gap-2.5">
              {EXPERIENCE.map((x) => (
                <button key={x.id} onClick={() => setExperience(x.id)} className="rounded-[var(--r-md)] px-[18px] py-4 text-left" style={cardSel(experience === x.id)}>
                  <div className="text-[15px] font-bold">{x.id}</div>
                  <div className="mt-0.5 text-[12px]" style={{ opacity: 0.8 }}>{x.sub}</div>
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step n="Step 4 · optional" title="A few numbers">
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              These let OpenSets personalize your plan and (later) calorie/protein
              targets. All optional — skip anything.
            </p>

            <OnbLabel>Sex</OnbLabel>
            <div className="flex gap-2.5">
              {(['male', 'female'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSex((cur) => (cur === s ? null : s))}
                  className="flex-1 rounded-[var(--r-md)] px-4 py-3.5 text-[14px] font-bold capitalize"
                  style={cardSel(sex === s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <OnbLabel>Date of birth</OnbLabel>
            <OnbBox>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                aria-label="Date of birth"
                className="min-w-0 flex-1 bg-transparent text-[16px] text-text placeholder:text-faint focus:outline-none"
                style={{ fontFamily: 'var(--font-num)' }}
              />
            </OnbBox>

            <OnbLabel>Height</OnbLabel>
            <div className="flex gap-2.5">
              <OnbBox>
                <input
                  type="number"
                  inputMode="numeric"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                  placeholder="—"
                  aria-label="Height feet"
                  className="min-w-0 flex-1 bg-transparent text-[18px] text-text placeholder:text-faint focus:outline-none"
                  style={{ fontFamily: 'var(--font-num)' }}
                />
                <span className="text-[14px] text-muted">ft</span>
              </OnbBox>
              <OnbBox>
                <input
                  type="number"
                  inputMode="numeric"
                  value={heightInch}
                  onChange={(e) => setHeightInch(e.target.value)}
                  placeholder="—"
                  aria-label="Height inches"
                  className="min-w-0 flex-1 bg-transparent text-[18px] text-text placeholder:text-faint focus:outline-none"
                  style={{ fontFamily: 'var(--font-num)' }}
                />
                <span className="text-[14px] text-muted">in</span>
              </OnbBox>
            </div>

            <OnbLabel>Bodyweight</OnbLabel>
            <OnbBox>
              <input
                type="number"
                inputMode="decimal"
                value={bodyweight}
                onChange={(e) => setBodyweight(e.target.value)}
                placeholder="—"
                aria-label="Bodyweight"
                className="min-w-0 flex-1 bg-transparent text-[18px] text-text placeholder:text-faint focus:outline-none"
                style={{ fontFamily: 'var(--font-num)' }}
              />
              <span className="text-[14px] text-muted">{units}</span>
            </OnbBox>

            <OnbLabel>Body fat %</OnbLabel>
            <OnbBox>
              <input
                type="number"
                inputMode="decimal"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                placeholder="—"
                aria-label="Body fat percent"
                className="min-w-0 flex-1 bg-transparent text-[18px] text-text placeholder:text-faint focus:outline-none"
                style={{ fontFamily: 'var(--font-num)' }}
              />
              <span className="text-[14px] text-muted">%</span>
            </OnbBox>

            <div
              className="mt-7 mb-1 text-[11px] font-bold uppercase text-faint"
              style={{ letterSpacing: 'var(--tracking-caps)', fontFamily: 'var(--font-label)' }}
            >
              Goal target · optional
            </div>
            <p className="mb-1 text-[12px] leading-relaxed text-muted">
              For a physique target — e.g. reach 12% body fat in 8 weeks.
            </p>
            <div className="flex gap-2.5">
              <OnbBox>
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetBodyFat}
                  onChange={(e) => setTargetBodyFat(e.target.value)}
                  placeholder="—"
                  aria-label="Target body fat percent"
                  className="min-w-0 flex-1 bg-transparent text-[18px] text-text placeholder:text-faint focus:outline-none"
                  style={{ fontFamily: 'var(--font-num)' }}
                />
                <span className="text-[13px] text-muted">% BF</span>
              </OnbBox>
              <OnbBox>
                <input
                  type="number"
                  inputMode="numeric"
                  value={timeframeWeeks}
                  onChange={(e) => setTimeframeWeeks(e.target.value)}
                  placeholder="—"
                  aria-label="Goal timeframe weeks"
                  className="min-w-0 flex-1 bg-transparent text-[18px] text-text placeholder:text-faint focus:outline-none"
                  style={{ fontFamily: 'var(--font-num)' }}
                />
                <span className="text-[13px] text-muted">weeks</span>
              </OnbBox>
            </div>
          </Step>
        )}

        {step === 5 && (
          <Step n="Recommended" title={`${goal} · ${days} days`} accentLabel>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              {goal === 'Get stronger' || experience === 'Novice' ? 'Linear' : 'Double'} progression ·{' '}
              {equipment.toLowerCase()} · built for {experience.toLowerCase()} lifters.
            </p>
            <div className="mt-5 flex flex-col gap-3.5">
              {(plan?.days ?? []).map((day) => (
                <div
                  key={day.name}
                  className="rounded-[var(--r-md)] border p-3.5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-text">{day.name}</span>
                    <span className="text-[11px] text-faint" style={{ fontFamily: 'var(--font-num)' }}>
                      {day.slots.length} exercises
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {day.slots.map((s, i) => (
                      <div key={s.exerciseId} className="flex items-center gap-2.5">
                        <span className="w-[18px] text-[11px] text-accent" style={{ fontFamily: 'var(--font-num)' }}>
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate text-[13px] text-text">{s.exerciseName}</span>
                        <span className="text-[11px] text-muted" style={{ fontFamily: 'var(--font-num)' }}>
                          {s.scheme.sets}×{s.scheme.repTarget ?? `${s.scheme.repRange?.[0]}–${s.scheme.repRange?.[1]}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Step>
        )}
      </div>

      <div className="flex-none px-[22px] pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          onClick={next}
          disabled={busy}
          className="h-[60px] w-full rounded-[var(--r-xl)] bg-accent text-[17px] font-bold text-accent-ink"
        >
          {busy ? 'Building…' : CTAS[step]}
        </button>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  accentLabel,
  children,
}: {
  n: string;
  title: string;
  accentLabel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className={`text-[11px] font-bold uppercase ${accentLabel ? 'text-accent' : 'text-faint'}`}
        style={{ letterSpacing: 'var(--tracking-caps)', fontFamily: 'var(--font-label)' }}
      >
        {n}
      </div>
      <div className="mt-2 text-[26px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/** Small uppercase field label, spaced for the onboarding "numbers" step. */
function OnbLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2 mt-5 text-[11px] font-bold uppercase text-faint"
      style={{ letterSpacing: 'var(--tracking-caps)', fontFamily: 'var(--font-label)' }}
    >
      {children}
    </div>
  );
}

/** Bordered input box matching the onboarding surface idiom. `min-w-0` lets it
 *  shrink to share width evenly when two sit side-by-side (e.g. ft/in). */
function OnbBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-md)] border px-4 py-3.5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
    >
      {children}
    </div>
  );
}
