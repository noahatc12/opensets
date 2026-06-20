/**
 * Theme selection — persistence + live apply (mode / color theme / design
 * template, plus optional custom seed). Applies to <html> via applyTheme so every
 * token re-resolves instantly. Stored in localStorage so it survives reloads and
 * is applied before first paint (initTheme in main.tsx).
 */
import { create } from 'zustand';
import { applyTheme, type ThemeSelection } from '../theme';

const KEY = 'opensets-theme';
const DEFAULT: ThemeSelection = { mode: 'dark', theme: 'teal', ds: 'readout' };

function load(): ThemeSelection {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Partial<ThemeSelection>) };
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
