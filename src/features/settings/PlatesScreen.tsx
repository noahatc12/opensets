import { useNavigate } from 'react-router-dom';
import { useSettings, updateSettings } from '../../db/hooks';
import { kgToLb } from '../../lib/units';
import { plateLook } from '../../lib/plates';
import { DEFAULT_LOAD_STEPS } from '../../engine/loading';
import { BackButton, SectionHead } from '../../ui/StatGrid';

/* Bar and plates. Plates are a physical, unit-specific thing: a kg gym has 25/20/15 kg
   plates, a lb gym has 45/35/25 lb plates. The set for the lifter's unit is shown and the
   lb equivalent is stored (plateInventoryLb is canonical). Each row is an own/not-own
   toggle with the plate's real colour. */

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];
const KG_BARS = [10, 15, 20, 25];
const LB_BARS = [35, 45, 55];
const EPS = 0.02;

export function PlatesScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const lb = settings.units === 'lb';
  const toLb = (v: number) => Math.round((lb ? v : kgToLb(v)) * 1000) / 1000;
  const ownsLb = (val: number) =>
    settings.plateInventoryLb.some((x) => Math.abs(x - val) < EPS);
  const plates = lb ? LB_PLATES : KG_PLATES;
  const bars = lb ? LB_BARS : KG_BARS;

  function togglePlate(displayVal: number): void {
    const val = toLb(displayVal);
    const has = ownsLb(val);
    const next = has
      ? settings.plateInventoryLb.filter((x) => Math.abs(x - val) >= EPS)
      : [...settings.plateInventoryLb, val];
    void updateSettings({ plateInventoryLb: next.sort((a, b) => a - b) });
  }

  return (
    <div className="h-full overflow-auto px-[18px] pb-[120px] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <BackButton onClick={() => navigate('/settings')} />
      <div className="os-t mt-3.5">Training</div>
      <h1 className="os-h1 mt-0.5">Bar and plates</h1>
      <p className="os-t mt-2 leading-[1.4]">
        The plates you own, assumed on both sides. Prescriptions round to what
        these can load.
      </p>

      <SectionHead>Plates</SectionHead>
      <div className="os-card" style={{ padding: '4px 16px' }}>
        {plates.map((d) => {
          const val = toLb(d);
          const owned = ownsLb(val);
          const look = plateLook(val, settings.units);
          return (
            <button
              key={d}
              type="button"
              onClick={() => togglePlate(d)}
              aria-pressed={owned}
              className="os-row os-press"
              style={{ opacity: owned ? 1 : 0.55 }}
            >
              <span
                className="flex-none rounded-full"
                style={{
                  width: 8 + look.h * 0.7,
                  height: 8 + look.h * 0.7,
                  background: look.color,
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,.35), inset 0 0 0 2px rgba(0,0,0,.18)',
                }}
                aria-hidden
              />
              <span
                className="os-num flex-1 text-[17px]"
                style={{ letterSpacing: '-.02em' }}
              >
                {d}
                <small className="os-t ml-1 text-[12px]">
                  {settings.units}
                </small>
              </span>
              <span
                className="os-radio"
                style={
                  owned
                    ? { background: 'var(--acc)', boxShadow: 'none' }
                    : undefined
                }
              >
                {owned && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden
                  >
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
        })}
      </div>

      <SectionHead>Bar weight</SectionHead>
      <div className="os-seg" role="radiogroup" aria-label="Bar weight">
        {bars.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={Math.abs(settings.barLb - toLb(b)) < EPS}
            onClick={() => void updateSettings({ barLb: toLb(b) })}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {b} {settings.units}
          </button>
        ))}
      </div>
      <p className="os-t mt-2 px-1 leading-snug">
        The bar counts toward the total. Most Olympic bars are{' '}
        {lb ? '45 lb' : '20 kg'}.
      </p>

      <SectionHead>Dumbbells and machines</SectionHead>
      <div className="os-card" style={{ padding: '4px 16px' }}>
        <StepRow
          label="Dumbbell jumps"
          options={lb ? [2.5, 5, 10] : [1, 2, 2.5]}
          valueLb={settings.dumbbellStepLb ?? DEFAULT_LOAD_STEPS.dumbbellStepLb}
          toLb={toLb}
          onPick={(v) => void updateSettings({ dumbbellStepLb: v })}
        />
        <StepRow
          label={`Under ${lb ? '20 lb' : '9 kg'}`}
          options={lb ? [1, 2.5, 5] : [0.5, 1, 2]}
          valueLb={
            settings.dumbbellSmallStepLb ??
            DEFAULT_LOAD_STEPS.dumbbellSmallStepLb
          }
          toLb={toLb}
          onPick={(v) => void updateSettings({ dumbbellSmallStepLb: v })}
        />
        <StepRow
          label="Cable and machine stack"
          options={lb ? [2.5, 5, 10] : [1, 2.5, 5]}
          valueLb={settings.stackStepLb ?? DEFAULT_LOAD_STEPS.stackStepLb}
          toLb={toLb}
          onPick={(v) => void updateSettings({ stackStepLb: v })}
        />
      </div>
      <p className="os-t mt-2 px-1 leading-snug">
        Dumbbell weights are per hand. Suggestions round to these jumps, so they
        match the racks and stacks at your gym.
      </p>
    </div>
  );
}

function StepRow({
  label,
  options,
  valueLb,
  toLb,
  onPick,
}: {
  label: string;
  options: number[];
  valueLb: number;
  toLb: (v: number) => number;
  onPick: (lb: number) => void;
}) {
  // Highlight the option nearest the stored step, so a kg user whose step is stored as
  // lb (5 lb = 2.27 kg) still sees which jump is in use.
  const nearest = options.reduce((a, b) =>
    Math.abs(toLb(b) - valueLb) < Math.abs(toLb(a) - valueLb) ? b : a,
  );
  return (
    <div
      className="os-row gap-2"
      style={{ flexDirection: 'column', alignItems: 'stretch' }}
    >
      <span className="text-[15px] font-semibold">{label}</span>
      <div className="os-seg" style={{ background: 'var(--s2)' }}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onPick(toLb(o))}
            aria-pressed={o === nearest}
            aria-label={`${label}: ${o}`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
