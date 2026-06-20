import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../library/useCatalog';
import { searchCatalog } from '../../db/catalog';
import type { Exercise } from '../../db/types';
import type { ProgressionRule } from '../../engine/types';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
} from '../../db/repositories';

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
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (!catalog) return;
    setBusy(true);
    const stronger = goal === 'Get stronger';
    const novice = experience === 'Novice';
    const increment = 2.5;
    const rule: ProgressionRule =
      stronger || novice
        ? { kind: 'linear', incrementKg: increment, failsBeforeDeload: 3, deloadPct: 0.1 }
        : { kind: 'double', repMin: 8, repMax: 12, incrementKg: increment, perSet: false };
    const scheme = stronger || novice ? { sets: 3, repTarget: 5 } : { sets: 3, repRange: [8, 12] as [number, number] };

    const queries = ['barbell squat', 'barbell bench press', 'barbell deadlift', 'overhead press', 'bent over barbell row'];
    const picks: Exercise[] = [];
    const seen = new Set<string>();
    for (const q of queries) {
      const hit = searchCatalog(catalog, q, 5).find((e) => !seen.has(e.id));
      if (hit) {
        picks.push(hit);
        seen.add(hit.id);
      }
    }

    const now = nowIso();
    const program = await createProgram(`${goal} · ${days}d`, now);
    await setActiveProgram(program.id);
    const tpl = await createTemplate(program.id, 'Day 1', 0);
    const slots = picks.map((ex, i) =>
      makeSlot(ex.id, i, rule, scheme, { warmupSec: 60, workSec: 180 }),
    );
    tpl.slots = slots;
    await saveTemplate(tpl);
    await Promise.all(
      slots.map((slot, i) => seedExerciseState(program.id, slot, ex0Weight(picks[i]!), now)),
    );
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
          className="size-[38px] bg-transparent text-[22px] text-muted"
          aria-label="Back"
        >
          ‹
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
              Tailors load jumps and bodyweight goals. Skip anytime.
            </p>
            <p className="mt-6 text-[13px] text-faint">
              (Optional profile inputs land with the full plan generator — for now your
              starter plan is built from your goal and experience.)
            </p>
          </Step>
        )}

        {step === 5 && (
          <Step n="Recommended" title={`${goal} starter`} accentLabel>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              {days} days · {goal === 'Get stronger' || experience === 'Novice' ? 'linear' : 'double'} progression · built for {experience.toLowerCase()} {goal.toLowerCase()}.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Row'].map((name, i) => (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-[var(--r-md)] border px-4 py-3.5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
                >
                  <span className="w-[26px] text-[11px] text-accent" style={{ fontFamily: 'var(--font-num)' }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[14px] font-semibold text-text">{name}</span>
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
      <div className={`text-[11px] font-bold uppercase tracking-wide ${accentLabel ? 'text-accent' : 'text-faint'}`}>
        {n}
      </div>
      <div className="mt-2 text-[26px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ex0Weight(ex: Exercise): number {
  return ex.isBodyweight ? 0 : 20;
}
