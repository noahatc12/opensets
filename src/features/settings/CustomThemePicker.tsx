import { useCallback, useRef, useState } from 'react';
import { hslToRgb, rgbToHex, hexToHsl, inkFor } from '../../theme';

/* ============================================================================
   CustomThemePicker — three-mode custom accent / base chooser.
   ----------------------------------------------------------------------------
   Ported from the OpenSets prototype custom-theme editor
   (OpenSets.dc.html lines 745-807): the preset accent swatch grid, the
   "Custom color" spectrum picker, and the ground-tint controls — recast here
   as three switchable modes (Grid / Spectrum / Sliders). Pure presentational:
   the integrator wires `value` / `onChange` to the theme store inside
   AppearanceScreen's custom section. Colors come from the Claude Design tokens
   (Tailwind token utilities + var(--token)); accent math comes from theme.ts.
   ========================================================================== */

export interface CustomThemeValue {
  baseColor: string; // hex — derived "ground" of the palette
  accent: string; // hex — brand accent
}

interface Props {
  value: CustomThemeValue;
  onChange: (v: CustomThemeValue) => void;
}

type Mode = 'grid' | 'spectrum' | 'sliders';

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: 'grid', label: 'Grid' },
  { value: 'spectrum', label: 'Spectrum' },
  { value: 'sliders', label: 'Sliders' },
];

/* Preset accents — the prototype's 25-swatch grid (hue / sat / light) ported
   verbatim from the data-hue/data-sat markup + each swatch's inline lightness. */
const PRESET_ACCENTS: ReadonlyArray<{ name: string; h: number; s: number; l: number }> = [
  { name: 'Amber', h: 40, s: 82, l: 58 },
  { name: 'Ember', h: 22, s: 85, l: 58 },
  { name: 'Red', h: 6, s: 78, l: 58 },
  { name: 'Rose', h: 344, s: 70, l: 60 },
  { name: 'Violet', h: 276, s: 58, l: 62 },
  { name: 'Indigo', h: 250, s: 66, l: 62 },
  { name: 'Blue', h: 222, s: 76, l: 58 },
  { name: 'Sky', h: 200, s: 78, l: 56 },
  { name: 'Teal', h: 174, s: 58, l: 50 },
  { name: 'Lime', h: 80, s: 72, l: 54 },
  { name: 'Gold', h: 48, s: 88, l: 56 },
  { name: 'Coral', h: 14, s: 80, l: 62 },
  { name: 'Pink', h: 330, s: 75, l: 64 },
  { name: 'Magenta', h: 300, s: 55, l: 60 },
  { name: 'Periwinkle', h: 235, s: 62, l: 64 },
  { name: 'Cyan', h: 190, s: 72, l: 50 },
  { name: 'Mint', h: 160, s: 55, l: 48 },
  { name: 'Green', h: 140, s: 55, l: 46 },
  { name: 'Olive', h: 95, s: 52, l: 48 },
  { name: 'Crimson', h: 0, s: 68, l: 52 },
  { name: 'Burgundy', h: 350, s: 55, l: 48 },
  { name: 'Plum', h: 312, s: 48, l: 54 },
  { name: 'Royal', h: 260, s: 72, l: 60 },
  { name: 'Azure', h: 212, s: 82, l: 56 },
  { name: 'Steel', h: 215, s: 28, l: 58 },
];

/* Ground tints — the prototype's Warm / Neutral / Cool ground swatches. The
   `l` keeps the base ground dark (it is the darkest surface in dark mode). */
const GROUND_TINTS: ReadonlyArray<{ name: string; h: number; s: number; l: number }> = [
  { name: 'Warm', h: 30, s: 18, l: 6 },
  { name: 'Neutral', h: 250, s: 10, l: 6 },
  { name: 'Cool', h: 205, s: 16, l: 6 },
];

const hsl = (h: number, s: number, l: number) => rgbToHex(hslToRgb(h, s, l));

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 'var(--tracking-caps)',
  textTransform: 'uppercase' as const,
  fontFamily: 'var(--font-label)',
  color: 'var(--faint)',
};

export function CustomThemePicker({ value, onChange }: Props) {
  const accentHsl = hexToHsl(value.accent);
  const baseHsl = hexToHsl(value.baseColor);

  const setAccent = useCallback(
    (accent: string) => onChange({ ...value, accent }),
    [onChange, value],
  );
  const setBase = useCallback(
    (baseColor: string) => onChange({ ...value, baseColor }),
    [onChange, value],
  );

  // which mode the control shows — local UI state only (no store).
  const [mode, setMode] = useState<Mode>('grid');

  return (
    <div
      className="rounded-[var(--r-lg)] border bg-surface p-[18px]"
      style={{ borderColor: 'var(--border-card)' }}
    >
      {/* header: copy + live accent chip */}
      <div className="flex items-center gap-3.5">
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-text">Build your own</div>
          <p className="mt-[3px] text-[11.5px] leading-[1.4] text-muted">
            Tap a color — every surface, border and text tier derives automatically.
          </p>
        </div>
        <div
          className="size-[52px] flex-none rounded-[var(--r-md)]"
          style={{ background: value.accent, boxShadow: 'var(--shadow-sm)' }}
        />
      </div>

      {/* mode toggle */}
      <div
        role="radiogroup"
        aria-label="Custom color mode"
        className="mt-[18px] flex gap-1 rounded-[var(--r-md)] p-[5px]"
        style={{ background: 'var(--bg)' }}
      >
        {MODES.map((m) => {
          const active = m.value === mode;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m.value)}
              className="h-9 flex-1 rounded-[var(--r-sm)] text-[13px]"
              style={{
                fontWeight: active ? 700 : 600,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent-ink)' : 'var(--muted)',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ---- GRID ---- */}
      {mode === 'grid' && (
        <div className="mt-[18px]">
          <div className="mb-[11px] text-[12px] text-muted">Accent color</div>
          <div className="grid grid-cols-5 gap-2.5">
            {PRESET_ACCENTS.map((p) => {
              const color = hsl(p.h, p.s, p.l);
              const active = color.toUpperCase() === value.accent.toUpperCase();
              return (
                <button
                  key={p.name}
                  type="button"
                  aria-label={p.name}
                  aria-pressed={active}
                  onClick={() => setAccent(color)}
                  className="h-12 rounded-[var(--r-md)] transition-transform active:scale-90"
                  style={{
                    background: color,
                    boxShadow: active ? '0 0 0 2px var(--bg), 0 0 0 4px var(--text)' : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ---- SPECTRUM ---- */}
      {mode === 'spectrum' && (
        <div className="mt-[18px]">
          <div className="mb-[11px] text-[12px] text-muted">Accent color</div>
          <SatLightArea
            hue={accentHsl.h}
            sat={accentHsl.s}
            light={accentHsl.l}
            onChange={(s, l) => setAccent(hsl(accentHsl.h, s, l))}
          />
          <HueStrip
            hue={accentHsl.h}
            onChange={(h) => setAccent(hsl(h, accentHsl.s, accentHsl.l))}
          />
        </div>
      )}

      {/* ---- SLIDERS ---- */}
      {mode === 'sliders' && (
        <div className="mt-[18px] flex flex-col gap-3.5">
          <div className="text-[12px] text-muted">Accent</div>
          <Slider
            label="Hue"
            min={0}
            max={360}
            value={accentHsl.h}
            track="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
            onChange={(h) => setAccent(hsl(h, accentHsl.s, accentHsl.l))}
          />
          <Slider
            label="Saturation"
            min={0}
            max={100}
            value={accentHsl.s}
            track={`linear-gradient(to right,${hsl(accentHsl.h, 0, accentHsl.l)},${hsl(accentHsl.h, 100, accentHsl.l)})`}
            onChange={(s) => setAccent(hsl(accentHsl.h, s, accentHsl.l))}
          />
          <Slider
            label="Lightness"
            min={0}
            max={100}
            value={accentHsl.l}
            track={`linear-gradient(to right,#000,${hsl(accentHsl.h, accentHsl.s, 50)},#fff)`}
            onChange={(l) => setAccent(hsl(accentHsl.h, accentHsl.s, l))}
          />

          <div className="mt-1.5 text-[12px] text-muted">Ground</div>
          <Slider
            label="Base lightness"
            min={2}
            max={18}
            value={baseHsl.l}
            track={`linear-gradient(to right,${hsl(baseHsl.h, baseHsl.s, 2)},${hsl(baseHsl.h, baseHsl.s, 18)})`}
            onChange={(l) => setBase(hsl(baseHsl.h, baseHsl.s, l))}
          />
        </div>
      )}

      {/* ground tint — shared across modes (prototype "Ground tint" row) */}
      <div className="mt-[18px]">
        <div className="mb-[11px] text-[12px] text-muted">Ground tint</div>
        <div className="flex gap-2">
          {GROUND_TINTS.map((g) => {
            const color = hsl(g.h, g.s, baseHsl.l);
            const active = hexToHsl(value.baseColor).h === g.h;
            return (
              <button
                key={g.name}
                type="button"
                aria-label={g.name}
                aria-pressed={active}
                onClick={() => setBase(color)}
                className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] border bg-surface text-[13px] font-semibold text-text"
                style={{ borderColor: active ? 'var(--accent)' : 'var(--border-card)' }}
              >
                <span
                  className="size-3.5 rounded-full"
                  style={{ background: hsl(g.h, Math.max(28, g.s + 22), 52) }}
                />
                {g.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* derived swatch preview — straight from the prototype */}
      <div className="mt-4 flex gap-1.5">
        <span
          className="h-[30px] flex-1 rounded-[7px] border"
          style={{ background: value.baseColor, borderColor: 'var(--border)' }}
        />
        <span className="h-[30px] flex-1 rounded-[7px]" style={{ background: 'var(--surface-2)' }} />
        <span className="h-[30px] flex-1 rounded-[7px]" style={{ background: 'var(--elevated)' }} />
        <span className="h-[30px] flex-1 rounded-[7px]" style={{ background: value.accent }} />
        <span
          className="grid h-[30px] flex-1 place-items-center rounded-[7px] text-[11px] font-bold"
          style={{ background: value.accent, color: inkFor(value.accent) }}
        >
          Aa
        </span>
      </div>

      <div className="mt-3 text-center text-[11px] text-faint" style={labelStyle}>
        {value.accent.toUpperCase()}
      </div>
    </div>
  );
}

/* ----- spectrum sub-controls ------------------------------------------------ */

/** 2D saturation (x) / lightness (y) selection area, pointer-driven. */
function SatLightArea({
  hue,
  sat,
  light,
  onChange,
}: {
  hue: number;
  sat: number;
  light: number;
  onChange: (sat: number, light: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const pick = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      onChange(Math.round(x * 100), Math.round((1 - y) * 100));
    },
    [onChange],
  );

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Saturation and lightness"
      aria-valuetext={`saturation ${sat}%, lightness ${light}%`}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) pick(e);
      }}
      className="relative h-[140px] w-full cursor-crosshair touch-none rounded-[var(--r-md)]"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsl(hue, 100, 50)})`,
      }}
    >
      <span
        className="pointer-events-none absolute size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          left: `${sat}%`,
          top: `${100 - light}%`,
          boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
          background: hsl(hue, sat, light),
        }}
      />
    </div>
  );
}

/** Horizontal hue strip 0..360. */
function HueStrip({ hue, onChange }: { hue: number; onChange: (hue: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  const pick = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      onChange(Math.round(x * 360));
    },
    [onChange],
  );

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={hue}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) pick(e);
      }}
      className="relative mt-2.5 h-[22px] w-full cursor-pointer touch-none rounded-[var(--r-pill)]"
      style={{
        background:
          'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
      }}
    >
      <span
        className="pointer-events-none absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{ left: `${(hue / 360) * 100}%`, background: hsl(hue, 90, 55), boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }}
      />
    </div>
  );
}

/* ----- sliders sub-control -------------------------------------------------- */

function Slider({
  label,
  min,
  max,
  value,
  track,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  track: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-text">{label}</span>
        <span
          className="text-[11px] text-muted"
          style={{ fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums' }}
        >
          {Math.round(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="os-range h-[22px] w-full cursor-pointer appearance-none rounded-[var(--r-pill)] bg-transparent"
        style={{ background: track }}
      />
    </label>
  );
}
