import { useNavigate } from 'react-router-dom';
import { useSettings, updateSettings } from '../../db/hooks';
import { ChevronLeftIcon, CheckIcon, PlusIcon } from '../../components/icons';

/* Ported from the Tempo prototype "showPlates" screen (OpenSets.dc.html
   lines 616-634). The prototype shows a per-side stepper, but our data model
   stores plateInventoryKg as a flat set of owned denominations (number[]),
   not per-side counts — so each row is an own/not-own toggle. Bar weight is a
   small segmented selector beneath the list. Persists via updateSettings. */

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};

/** Standard kg denominations offered, heaviest first (prototype order). */
const DENOMINATIONS = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25] as const;

/** Bar weights to choose from (kg). */
const BAR_OPTIONS = [10, 15, 20, 25] as const;

/** Swatch sizing/tint, scaled by denomination weight (mirrors prototype). */
function swatch(kg: number): { size: number; bg: string } {
  if (kg >= 25) return { size: 16, bg: 'var(--accent)' };
  if (kg >= 20)
    return { size: 16, bg: 'color-mix(in oklab, var(--accent) 70%, var(--surface-2))' };
  if (kg >= 10)
    return { size: 14, bg: 'color-mix(in oklab, var(--accent) 50%, var(--surface-2))' };
  if (kg >= 5) return { size: 12, bg: 'var(--surface-2)' };
  if (kg >= 2.5) return { size: 10, bg: 'var(--surface-2)' };
  if (kg >= 1.25) return { size: 9, bg: 'var(--surface-2)' };
  return { size: 8, bg: 'var(--surface-2)' };
}

export function PlatesScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const owned = new Set(settings.plateInventoryKg);

  function toggle(kg: number): void {
    const next = new Set(owned);
    if (next.has(kg)) next.delete(kg);
    else next.add(kg);
    void updateSettings({
      plateInventoryKg: [...next].sort((a, b) => a - b),
    });
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
        <div
          className="text-[20px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-snug)' }}
        >
          Plate inventory
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-7 pt-1.5">
        <div className="mx-0.5 mb-3.5 text-[13px] leading-[1.4] text-muted">
          Plates you own, per side. Used to round prescriptions to loadable weights.
        </div>

        <div className="flex flex-col gap-2">
          {DENOMINATIONS.map((kg) => {
            const sw = swatch(kg);
            const isOwned = owned.has(kg);
            return (
              <button
                key={kg}
                onClick={() => toggle(kg)}
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
                  style={{
                    width: sw.size,
                    height: sw.size,
                    background: isOwned ? sw.bg : 'var(--surface-2)',
                  }}
                />
                <span className="flex-1 text-[15px] font-semibold text-text" style={numFont}>
                  {kg}
                  <span className="text-[11px] text-muted"> kg</span>
                </span>
                <span
                  className="grid size-7 place-items-center rounded-full"
                  style={{
                    background: isOwned ? 'var(--accent)' : 'var(--surface-2)',
                    color: isOwned ? 'var(--accent-ink)' : 'var(--faint)',
                  }}
                >
                  {isOwned ? (
                    <CheckIcon className="size-[14px]" />
                  ) : (
                    <PlusIcon className="size-4" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mx-1 mb-2.5 mt-[26px] text-[11px] font-bold uppercase tracking-wide text-faint">
          Bar weight
        </div>
        <div
          className="flex items-center justify-between rounded-[var(--r-md)] border px-4 py-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        >
          <span className="text-[14px] font-semibold text-text">Barbell</span>
          <div className="flex gap-1 rounded-[var(--r-sm)] p-1" style={{ background: 'var(--bg)' }}>
            {BAR_OPTIONS.map((b) => {
              const active = settings.barKg === b;
              return (
                <button
                  key={b}
                  onClick={() => void updateSettings({ barKg: b })}
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
          The bar counts toward total load. Most Olympic barbells are 20 kg.
        </p>
      </div>
    </div>
  );
}
