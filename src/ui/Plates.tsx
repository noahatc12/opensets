import { plateLook } from '../lib/plates';
import type { WeightUnit } from '../lib/units';

/** A row of plate marks, largest first, with the sleeve stub on the left. */
export function PlateMarks({
  platesLb,
  units,
  sleeve = true,
  label,
}: {
  platesLb: number[];
  units: WeightUnit;
  sleeve?: boolean;
  label?: string;
}) {
  const sorted = [...platesLb].sort((a, b) => b - a);
  return (
    <span
      className="os-plates"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {sleeve && <i className="os-sleeve" />}
      {sorted.map((p, i) => {
        const look = plateLook(p, units);
        return (
          <i
            key={i}
            style={{
              background: look.color,
              height: look.h,
              width: p >= 25 ? 8 : 6,
            }}
          />
        );
      })}
    </span>
  );
}

/** The loaded bar, drawn to scale: sleeve end, collar, plates largest inboard, then the bar. */
export function BarDiagram({
  platesLb,
  units,
}: {
  platesLb: number[];
  units: WeightUnit;
}) {
  const sorted = [...platesLb].sort((a, b) => b - a);
  return (
    <div
      className="flex items-center gap-[3px] px-[18px]"
      style={{
        height: 150,
        borderRadius: 18,
        background: 'var(--bg)',
        boxShadow: 'inset 0 1px 0 rgba(0,0,0,.5), inset 0 -1px 0 var(--hl)',
      }}
      aria-hidden
    >
      {/* sleeve end */}
      <span
        style={{
          width: 56,
          height: 12,
          borderRadius: 3,
          background: 'linear-gradient(180deg,#9ca3af,#6b7280)',
          flex: 'none',
        }}
      />
      {/* collar, outside the plates */}
      <span
        style={{
          width: 12,
          height: 34,
          borderRadius: 3,
          background: 'linear-gradient(180deg,#b0b7c3,#7d8593)',
          flex: 'none',
        }}
      />
      {[...sorted].reverse().map((p, i) => {
        const look = plateLook(p, units);
        const h = 40 + (look.h - 5) * 3.7;
        const w = p >= 25 ? 26 : p >= 10 ? 16 : p >= 5 ? 12 : 9;
        const dark =
          look.color === 'var(--p10)' ||
          look.color === 'var(--p35)' ||
          look.color === 'var(--p1)';
        return (
          <span
            key={i}
            style={{
              width: w,
              height: h,
              borderRadius: w > 12 ? 5 : 3,
              background: `linear-gradient(180deg, color-mix(in oklab, ${look.color} 80%, white), ${look.color})`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)',
              display: 'grid',
              placeItems: 'center',
              fontSize: w > 12 ? 11 : 9,
              fontWeight: 800,
              color: dark ? '#333' : '#fff',
              writingMode: 'vertical-rl',
              flex: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {w > 8 ? look.denom : ''}
          </span>
        );
      })}
      {/* bar */}
      <span
        style={{
          flex: 1,
          height: 12,
          borderRadius: '0 3px 3px 0',
          background: 'linear-gradient(180deg,#9ca3af,#6b7280)',
          opacity: 0.7,
        }}
      />
    </div>
  );
}
