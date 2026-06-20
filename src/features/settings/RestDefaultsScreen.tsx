import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings, updateSettings } from '../../db/hooks';
import { ChevronLeftIcon, PlusIcon, MinusIcon } from '../../components/icons';

/* Ported from the OpenSets prototype `showRestDefaults` screen (Rest timer):
   header (‹ back + title) + scroll body. The prototype's per-type rows are a
   static mock; here they're real steppers writing settings.defaultRestWarmupSec
   and settings.defaultRestWorkSec (stored in seconds, shown as m:ss). The ±Step
   segmented control picks the stepper increment. */

const numFont = {
  fontFamily: 'var(--font-num)',
  fontVariantNumeric: 'tabular-nums' as const,
};

const STEPS = [10, 15, 30] as const;
type Step = (typeof STEPS)[number];

const MIN_SEC = 0;
const MAX_SEC = 600; // 10:00 cap

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const clamp = (n: number) => Math.min(MAX_SEC, Math.max(MIN_SEC, n));

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div
    className="mt-[22px] mb-2.5 mx-1 text-[11px] font-bold uppercase text-faint"
    style={{ letterSpacing: 'var(--tracking-caps)', fontFamily: 'var(--font-label)' }}
  >
    {children}
  </div>
);

type RestField = 'defaultRestWarmupSec' | 'defaultRestWorkSec';

function StepperRow({
  label,
  field,
  seconds,
  step,
}: {
  label: string;
  field: RestField;
  seconds: number;
  step: Step;
}) {
  const set = (next: number) => void updateSettings({ [field]: clamp(next) });
  return (
    <div
      className="flex items-center justify-between rounded-[var(--r-md)] border px-4 py-2.5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
    >
      <span className="text-[14px] text-text">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => set(seconds - step)}
          aria-label={`Decrease ${label}`}
          className="grid size-[34px] place-items-center rounded-[var(--r-pill)] text-muted"
          style={{ background: 'var(--bg)' }}
        >
          <MinusIcon className="size-5" />
        </button>
        <span
          className="w-[58px] text-center text-[16px] font-semibold text-accent"
          style={numFont}
        >
          {fmt(seconds)}
        </span>
        <button
          onClick={() => set(seconds + step)}
          aria-label={`Increase ${label}`}
          className="grid size-[34px] place-items-center rounded-[var(--r-pill)] text-muted"
          style={{ background: 'var(--bg)' }}
        >
          <PlusIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}

export function RestDefaultsScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [step, setStep] = useState<Step>(15);

  return (
    <div className="flex h-full flex-col">
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
          Rest timer
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-7 pt-1.5">
        <SectionLabel>Default by set type</SectionLabel>
        <div className="flex flex-col gap-2">
          <StepperRow
            label="Warm-up sets"
            field="defaultRestWarmupSec"
            seconds={settings.defaultRestWarmupSec}
            step={step}
          />
          <StepperRow
            label="Working sets"
            field="defaultRestWorkSec"
            seconds={settings.defaultRestWorkSec}
            step={step}
          />
        </div>

        <SectionLabel>±&nbsp;Step</SectionLabel>
        <div
          className="flex gap-1.5 rounded-[var(--r-md)] border p-[5px]"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        >
          {STEPS.map((s) => {
            const active = s === step;
            return (
              <button
                key={s}
                onClick={() => setStep(s)}
                className="flex-1 rounded-[var(--r-sm)] py-2.5 text-center text-[14px]"
                style={{
                  fontFamily: 'var(--font-num)',
                  fontWeight: active ? 700 : 600,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-ink)' : 'var(--muted)',
                }}
              >
                {s}s
              </button>
            );
          })}
        </div>

        <p className="mx-1 mt-2 text-[11px] leading-snug text-faint">
          The rest timer starts at these lengths after each logged set.
        </p>
      </div>
    </div>
  );
}
