/**
 * Theme selection — persistence + live apply (mode / color theme / design
 * template, plus optional custom seed). Applies to <html> via applyTheme so every
 * token re-resolves instantly. Stored in localStorage so it survives reloads and
 * is applied before first paint (initTheme in main.tsx).
 */
import { create } from 'zustand';
import { applyTheme, PREMIUM_THEME, type ThemeSelection } from '../theme';

const KEY = 'opensets-theme';
const DEFAULT: ThemeSelection = {
  mode: 'dark',
  theme: PREMIUM_THEME,
  ds: 'editorial',
};

/** The premium skin replaces the earlier ones: any stored selection keeps its mode and
 *  lands on the single accent. There is no appearance picker beyond dark and light. */
function migrate(sel: ThemeSelection): ThemeSelection {
  return {
    mode: sel.mode === 'light' ? 'light' : 'dark',
    theme: PREMIUM_THEME,
    ds: 'editorial',
  };
}

function load(): ThemeSelection {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw)
      return migrate({
        ...DEFAULT,
        ...(JSON.parse(raw) as Partial<ThemeSelection>),
      });
  } catch {
    /* ignore */
  }
  return DEFAULT;
}

function persistAndApply(sel: ThemeSelection): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sel));
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    applyTheme(document.documentElement, sel);
    // The browser chrome and the Home Screen container's reserved zones take their
    // colour from this tag; it follows the mode so neither reads as a bar.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
      meta.setAttribute(
        'content',
        sel.mode === 'light' ? '#eeece7' : '#0d0f13',
      );
  }
}

/** Apply the stored selection before React renders (call once in main.tsx). */
export function initTheme(): void {
  persistAndApply(load());
}

interface ThemeState {
  selection: ThemeSelection;
  update: (patch: Partial<ThemeSelection>) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  selection: load(),
  update: (patch) => {
    const selection = { ...get().selection, ...patch };
    persistAndApply(selection);
    set({ selection });
  },
}));
