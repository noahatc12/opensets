/**
 * The gesture feel: every spring and threshold the swipe-back and the sheets read, in one
 * place, so they can be tuned in the hand. "now" on both axes is exactly what shipped on
 * 2026-09-27 (tuned from Vaul's thresholds and the iOS curve, never from a device).
 *
 * Two axes per gesture, three settings each:
 *  - speed scales the spring's response time. Stiffness goes by 1/s^2 and damping by 1/s,
 *    so the damping ratio, and with it how much anything overshoots, never changes.
 *  - trigger scales how far a drag must travel, and how fast a flick must be, to commit.
 *
 * The choice lives in localStorage so it survives app launches; the tuning panel
 * (ui/FeelPanel.tsx) is how it is set.
 */

export type Speed = 'snappy' | 'now' | 'soft';
export type Trigger = 'easy' | 'now' | 'firm';
export type Gesture = 'back' | 'sheet';
export type FeelChoice = Record<Gesture, { speed: Speed; trigger: Trigger }>;

export interface SpringParams {
  stiffness: number;
  damping: number;
}

/** Response-time multiplier per speed. */
export const SPEED_SCALE: Record<Speed, number> = {
  snappy: 0.8,
  now: 1,
  soft: 1.25,
};

/** Distance and flick-velocity multiplier per trigger. */
export const TRIGGER_SCALE: Record<Trigger, number> = {
  easy: 0.75,
  now: 1,
  firm: 1.3,
};

/** What shipped. Changing a number here changes the app for everyone. */
export const SHIPPED = {
  back: {
    release: { stiffness: 260, damping: 30 },
    home: { stiffness: 420, damping: 38 },
    closeFraction: 0.33,
    flick: 0.45,
  },
  sheet: {
    close: { stiffness: 300, damping: 34 },
    home: { stiffness: 420, damping: 38 },
    flickHome: { stiffness: 320, damping: 26 },
    closeFraction: 0.35,
    flick: 0.4,
  },
} as const;

export const DEFAULT_CHOICE: FeelChoice = {
  back: { speed: 'now', trigger: 'now' },
  sheet: { speed: 'now', trigger: 'now' },
};

const KEY = 'opensets-feel';
const TUNE_KEY = 'opensets-tune';

export function scaleSpring(p: SpringParams, speed: Speed): SpringParams {
  const s = SPEED_SCALE[speed];
  return { stiffness: p.stiffness / (s * s), damping: p.damping / s };
}

export function backFeel(choice: FeelChoice = current) {
  const { speed, trigger } = choice.back;
  const t = TRIGGER_SCALE[trigger];
  return {
    release: scaleSpring(SHIPPED.back.release, speed),
    home: scaleSpring(SHIPPED.back.home, speed),
    closeFraction: SHIPPED.back.closeFraction * t,
    flick: SHIPPED.back.flick * t,
  };
}

export function sheetFeel(choice: FeelChoice = current) {
  const { speed, trigger } = choice.sheet;
  const t = TRIGGER_SCALE[trigger];
  return {
    close: scaleSpring(SHIPPED.sheet.close, speed),
    home: scaleSpring(SHIPPED.sheet.home, speed),
    flickHome: scaleSpring(SHIPPED.sheet.flickHome, speed),
    closeFraction: SHIPPED.sheet.closeFraction * t,
    flick: SHIPPED.sheet.flick * t,
  };
}

const SPEEDS: readonly Speed[] = ['snappy', 'now', 'soft'];
const TRIGGERS: readonly Trigger[] = ['easy', 'now', 'firm'];

/** Anything stored that is not a known setting falls back to what shipped. */
export function parseChoice(raw: string | null): FeelChoice {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<FeelChoice>) : null;
    const pick = (g: Gesture) => ({
      speed: SPEEDS.includes(v?.[g]?.speed as Speed)
        ? (v![g]!.speed as Speed)
        : 'now',
      trigger: TRIGGERS.includes(v?.[g]?.trigger as Trigger)
        ? (v![g]!.trigger as Trigger)
        : 'now',
    });
    return { back: pick('back'), sheet: pick('sheet') };
  } catch {
    return DEFAULT_CHOICE;
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
}

let current: FeelChoice = parseChoice(read(KEY));
let tuning = read(TUNE_KEY) === '1';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeFeel(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getFeel(): FeelChoice {
  return current;
}

export function setFeel(g: Gesture, patch: Partial<FeelChoice[Gesture]>): void {
  current = { ...current, [g]: { ...current[g], ...patch } };
  write(KEY, JSON.stringify(current));
  emit();
}

export function resetFeel(): void {
  current = DEFAULT_CHOICE;
  write(KEY, null);
  emit();
}

export function isTuning(): boolean {
  return tuning;
}

export function setTuning(on: boolean): void {
  tuning = on;
  write(TUNE_KEY, on ? '1' : null);
  emit();
}
