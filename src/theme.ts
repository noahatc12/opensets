/* ============================================================================
   OpenSets — Theme System (TypeScript)
   ----------------------------------------------------------------------------
   Two orthogonal axes + a design-template axis, all applied as data-attributes
   on a single ancestor element. theme.css does the rest with var(--token).

       <div data-mode="dark" data-theme="tempo" data-ds="tempo"> … </div>

   This module gives you:
     • Typed registries for the three axes (Mode / ColorTheme / DesignTemplate).
     • CURATED_THEMES — every shipped preset, with a swatch color for pickers.
     • deriveCustomTheme() — computes a FULL, coherent palette from a user's
       chosen base + accent (surfaces, borders, 3 text tiers, accent ramp,
       semantics). Mirrors the `[data-theme="custom"]` CSS rules in JS so you
       can render the palette without relying on CSS color-mix if you prefer.
     • applyTheme() — sets the data-attributes (and custom seed vars) on a node.
   ========================================================================== */

export type Mode = 'dark' | 'light';
export type DesignTemplate = 'tempo' | 'readout';
export type ColorTheme =
  | 'tempo' | 'teal' | 'graphite' | 'steel' | 'volt'
  | 'ember' | 'clinic' | 'midnight' | 'rose' | 'pine' | 'custom';

/* ----------------------------------------------------------------------------
   CURATED THEMES — the shipped presets. `swatch` is what a theme picker renders
   (the dark-mode accent); the authoritative values live in theme.css keyed by
   [data-theme]. `retintNeutrals` flags themes whose neutrals shift with the
   accent (steel / volt / midnight), so a picker can preview them correctly.
---------------------------------------------------------------------------- */
export interface CuratedTheme {
  id: Exclude<ColorTheme, 'custom'>;
  label: string;
  swatch: string;          // accent shown in the picker (dark mode)
  retintNeutrals: boolean;
  bestIn?: Mode;           // optional hint
}

export const CURATED_THEMES: CuratedTheme[] = [
  { id: 'tempo',    label: 'Tempo',      swatch: '#cda35f', retintNeutrals: false },
  { id: 'teal',     label: 'Teal',       swatch: '#1fe0c4', retintNeutrals: false },
  { id: 'graphite', label: 'Graphite',   swatch: '#e8e6e1', retintNeutrals: false },
  { id: 'steel',    label: 'Cold Steel', swatch: '#6fa0d6', retintNeutrals: true  },
  { id: 'volt',     label: 'Volt',       swatch: '#c2ee3f', retintNeutrals: true  },
  { id: 'ember',    label: 'Ember',      swatch: '#ff7a3c', retintNeutrals: false },
  { id: 'clinic',   label: 'Clinic',     swatch: '#2f7df0', retintNeutrals: false, bestIn: 'light' },
  { id: 'midnight', label: 'Midnight',   swatch: '#8d8ef2', retintNeutrals: true  },
  { id: 'rose',     label: 'Rose',       swatch: '#e06a86', retintNeutrals: false },
  { id: 'pine',     label: 'Pine',       swatch: '#3fae6b', retintNeutrals: false },
];

/* ============================================================================
   COLOR MATH  (sRGB / HSL / oklab)
   ----------------------------------------------------------------------------
   hslToRgb / hexToHsl / relativeLuminance match the prototype's color picker.
   mixOklab() is a JS port of CSS `color-mix(in oklab, a, b t%)` so the custom
   palette can be computed without the browser.
   ========================================================================== */

type RGB = [number, number, number]; // 0..255

export function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as RGB;
}

export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  const R = rgb[0] / 255,
    G = rgb[1] / 255,
    B = rgb[2] / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === R) h = ((G - B) / d) % 6;
    else if (mx === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** WCAG relative luminance (0..1) of an sRGB triple. */
export function relativeLuminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Ink (text/icon) color that sits ON a given accent — matches the prototype:
 *  light accent → near-black, dark accent → white. */
export function inkFor(accentHex: string): string {
  return relativeLuminance(hexToRgb(accentHex)) > 0.45 ? '#15110A' : '#FFFFFF';
}

// --- sRGB <-> linear <-> oklab -------------------------------------------
const toLin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const toSrgb = (c: number) => { const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };

function rgbToOklab([r, g, b]: RGB): [number, number, number] {
  const lr = toLin(r), lg = toLin(g), lb = toLin(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
function oklabToRgb([L, A, B]: [number, number, number]): RGB {
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.2914855480 * B;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    toSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

/** JS equivalent of CSS `color-mix(in oklab, aHex, bHex t)` where t∈0..1 is the
 *  weight of bHex. Returns a hex string. */
export function mixOklab(aHex: string, bHex: string, t: number): string {
  const a = rgbToOklab(hexToRgb(aHex));
  const b = rgbToOklab(hexToRgb(bHex));
  const m: [number, number, number] = [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  return rgbToHex(oklabToRgb(m));
}

/* ============================================================================
   CUSTOM THEME DERIVATION
   ----------------------------------------------------------------------------
   Given a user's chosen base ground + accent (+ mode), produce a full coherent
   token map. Surfaces step toward the "lift" color (white in dark, near-black
   in light) in fixed increments; text tiers step the same way. These percentages
   are the single source of the palette rhythm — identical to the CSS rules in
   theme.css under [data-theme="custom"].
   ========================================================================== */

export interface CustomSeed {
  /** Base ground color (darkest surface in dark mode, lightest in light). */
  baseColor: string;   // hex
  /** Brand accent. */
  accent: string;      // hex
  mode: Mode;
}

export interface DerivedPalette {
  // neutrals
  bg: string; surface: string; surface2: string; elevated: string;
  border: string; borderStrong: string;
  // text tiers
  text: string; muted: string; faint: string;
  // accent ramp
  accent: string; accentHover: string; accentInk: string; pr: string;
  // shared semantics (carried from the base mode — not derived from accent)
  success: string; warning: string; danger: string;
}

// fixed step percentages — keep in lockstep with theme.css [data-theme="custom"]
const DARK_STEPS = { surface: 5, surface2: 9, elevated: 14, border: 14, borderStrong: 24, text: 92, muted: 56, faint: 32 };
const LIGHT_STEPS = { surface2: 4, border: 12, borderStrong: 20, text: 90, muted: 55, faint: 32 };

const SEMANTICS = {
  dark:  { success: '#6FBF8E', warning: '#E0A85C', danger: '#E0735C' },
  light: { success: '#2F9E63', warning: '#BD7E1C', danger: '#CF4D36' },
};

/** Full palette, computed in JS (no CSS color-mix needed). */
export function deriveCustomTheme({ baseColor, accent, mode }: CustomSeed): DerivedPalette {
  const accentInk = inkFor(accent);
  const accentHover = mixOklab(accent, mode === 'dark' ? '#FFFFFF' : '#1A1714', 0.16);
  const pr = mixOklab(accent, '#F4D98A', 0.55);
  const sem = SEMANTICS[mode];

  if (mode === 'dark') {
    const lift = '#FFFFFF';
    const mix = (t: number) => mixOklab(baseColor, lift, t / 100);
    return {
      bg: baseColor,
      surface: mix(DARK_STEPS.surface),
      surface2: mix(DARK_STEPS.surface2),
      elevated: mix(DARK_STEPS.elevated),
      border: mix(DARK_STEPS.border),
      borderStrong: mix(DARK_STEPS.borderStrong),
      text: mix(DARK_STEPS.text),
      muted: mix(DARK_STEPS.muted),
      faint: mix(DARK_STEPS.faint),
      accent, accentHover, accentInk, pr, ...sem,
    };
  }

  // light
  const lift = '#1A1714';
  const mix = (t: number) => mixOklab(baseColor, lift, t / 100);
  return {
    bg: baseColor,
    surface: mixOklab(baseColor, '#FFFFFF', 0.6),
    surface2: mix(LIGHT_STEPS.surface2),
    elevated: '#FFFFFF',
    border: mix(LIGHT_STEPS.border),
    borderStrong: mix(LIGHT_STEPS.borderStrong),
    text: mix(LIGHT_STEPS.text),
    muted: mix(LIGHT_STEPS.muted),
    faint: mix(LIGHT_STEPS.faint),
    accent, accentHover, accentInk, pr, ...sem,
  };
}

/** Map a DerivedPalette to the CSS custom properties theme.css expects. Spread
 *  onto an element's style to render the custom theme without the [data-theme]
 *  CSS rules. */
export function paletteToCssVars(p: DerivedPalette): Record<string, string> {
  return {
    '--bg': p.bg, '--surface': p.surface, '--surface-2': p.surface2, '--elevated': p.elevated,
    '--border': p.border, '--border-strong': p.borderStrong,
    '--text': p.text, '--muted': p.muted, '--faint': p.faint,
    '--accent': p.accent, '--accent-hover': p.accentHover, '--accent-ink': p.accentInk, '--pr': p.pr,
    '--success': p.success, '--warning': p.warning, '--danger': p.danger,
  };
}

/* ============================================================================
   APPLY
   ----------------------------------------------------------------------------
   Two ways to drive the custom theme:
   (A) Let CSS do the math — set data-theme="custom" + the three seed vars; the
       [data-theme="custom"] rules in theme.css derive the rest with color-mix.
   (B) Compute in JS — deriveCustomTheme() → paletteToCssVars() → spread inline.
   applyTheme() uses path (A), matching the prototype exactly.
   ========================================================================== */

export interface ThemeSelection {
  mode: Mode;
  theme: ColorTheme;
  ds?: DesignTemplate;
  /** Only when theme === 'custom'. */
  custom?: { baseColor: string; accent: string };
}

export function applyTheme(el: HTMLElement, sel: ThemeSelection): void {
  el.dataset.mode = sel.mode;
  el.dataset.theme = sel.theme;
  el.dataset.ds = sel.ds ?? 'tempo';

  // clear any prior seed vars
  el.style.removeProperty('--seed-bg');
  el.style.removeProperty('--seed-accent');
  el.style.removeProperty('--seed-ink');

  if (sel.theme === 'custom' && sel.custom) {
    el.style.setProperty('--seed-bg', sel.custom.baseColor);
    el.style.setProperty('--seed-accent', sel.custom.accent);
    el.style.setProperty('--seed-ink', inkFor(sel.custom.accent));
  }
}
