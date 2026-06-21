import { useNavigate } from 'react-router-dom';
import { useSettings, updateSettings } from '../../db/hooks';
import { lbToKg } from '../../lib/units';
import { ChevronLeftIcon, CheckIcon, PlusIcon } from '../../components/icons';

/* Ported from the Tempo prototype "showPlates" screen (OpenSets.dc.html
   lines 616-634). Plates are a physical, unit-specific thing: a kg gym has
   25/20/15… kg plates, a lb gym has 45/35/25… lb plates. We show the set for
   the user's unit and store the kg-equivalent (plateInventoryKg is canonical).
   Each row is an own/not-own toggle (the model is a flat set, not per-side
   counts). Persists via updateSettings. */

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};

/** Standard plate denominations per unit, heaviest first. */
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];
/** Bar weights offered per unit. */
const KG_BARS = [10, 15, 20, 25];
const LB_BARS = [35, 45, 55];

const EPS = 0.02; // kg tolerance for matching a converted denomination

export function PlatesScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const lb = settings.units === 'lb';

  /** Display denomination → its canonical kg (rounded to avoid float drift). */
  const toKg = (v: number) => Math.round((lb ? lbToKg(v) : v) * 1000) / 1000;
  const ownsKg = (kg: number) => settings.plateInventoryKg.some((x) => Math.abs(x - kg) < EPS);

  const plates = lb ? LB_PLATES : KG_PLATES;
  const bars = lb ? LB_BARS : KG_BARS;

  function togglePlate(displayVal: number): void {
    const kg = toKg(displayVal);
    const has = settings.plateInventoryKg.some((x) => Math.abs(x - kg) < EPS);
    const next = has
      ? settings.plateInventoryKg.filter((x) => Math.abs(x - kg) >= EPS)
      : [...settings.plateInventoryKg, kg];
    void updateSettings({ plateInventoryKg: next.sort((a, b) => a - b) });
  }

  /** Swatch sizing/tint, scaled by the canonical kg (mirrors prototype). */
  function swatch(kg: number): { size: number; bg: string } {
    if (kg >= 25) return { size: 16, bg: 'var(--accent)' };
    if (kg >= 20) return { size: 16, bg: 'color-mix(in oklab, var(--accent) 70%, var(--surface-2))' };
    if (kg >= 10) return { size: 14, bg: 'color-mix(in oklab, var(--accent) 50%, var(--surface-2))' };
    if (kg >= 5) return { size: 12, bg: 'var(--surface-2)' };
    if (kg >= 2.5) return { size: 10, bg: 'var(--surface-2)' };
    if (kg >= 1.25) return { size: 9, bg: 'var(--surface-2)' };
    return { size: 8, bg: 'var(--surface-2)' };
  }

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
        <div className="text-[20px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
          Plate inventory
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-7 pt-1.5">
        <div className="mx-0.5 mb-3.5 text-[13px] leading-[1.4] text-muted">
          Select the plate denominations you own — assumed available on both sides.
          Prescriptions round to the nearest weight these can load.
        </div>

        <div className="flex flex-col gap-2">
          {plates.map((d) => {
            const kg = toKg(d);
            const sw = swatch(kg);
            const isOwned = ownsKg(kg);
            return (
              <button
                key={d}
                onClick={() => togglePlate(d)}
                aria-pressed={isOwned}
                className="flex items-center gap-3.5 rounded-[var(--r-md)] border px-3.5 py-[11px] text-left transition-opacity"
                style={{
                  background: 'var(--surface)',
                  borderColor: isOwned
                    ? 'color-mix(in oklab, var(--accent) 40%, var(--border-card))'
                    : 'var(--border-card)',
                  opacity: isOwned ? 1 : 0.55,
                }}
              >
                <span
                  className="flex-none rounded-full"
                  style={{ width: sw.size, height: sw.size, background: isOwned ? sw.bg : 'var(--surface-2)' }}
                />
                <span className="flex-1 text-[15px] font-semibold text-text" style={numFont}>
                  {d}
                  <span className="text-[11px] text-muted"> {settings.units}</span>
                </span>
                <span
                  className="grid size-7 place-items-center rounded-full"
                  style={{
                    background: isOwned ? 'var(--accent)' : 'var(--surface-2)',
                    color: isOwned ? 'var(--accent-ink)' : 'var(--faint)',
                  }}
                >
                  {isOwned ? <CheckIcon className="size-[14px]" /> : <PlusIcon className="size-4" />}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="mx-1 mb-2.5 mt-[26px] text-[11px] font-bold uppercase text-faint"
          style={{ letterSpacing: 'var(--tracking-caps)', fontFamily: 'var(--font-label)' }}
        >
          Bar weight
        </div>
        <div
          className="flex items-center justify-between rounded-[var(--r-md)] border px-4 py-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        >
          <span className="text-[14px] font-semibold text-text">Barbell</span>
          <div className="flex gap-1 rounded-[var(--r-sm)] p-1" style={{ background: 'var(--bg)' }}>
            {bars.map((b) => {
              const active = Math.abs(settings.barKg - toKg(b)) < EPS;
              return (
                <button
                  key={b}
                  onClick={() => void updateSettings({ barKg: toKg(b) })}
                  className="rounded-[7px] px-3 py-1.5 text-[13px]"
                  style={{
                    ...numFont,
                    fontWeight: active ? 700 : 600,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-ink)' : 'var(--muted)',
                  }}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mx-1 mt-2 text-[11px] leading-snug text-faint">
          The bar counts toward total load. Most Olympic barbells are {lb ? '45 lb' : '20 kg'}.
        </p>
      </div>
    </div>
  );
}
