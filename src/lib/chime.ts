/* A short two-note chime for the end of a rest, drawn with WebAudio so it ships no sound
   file. A phone only lets a page make sound after a tap, so primeChime() runs on Log set
   (a tap) and opens the audio context; playChime() then sounds at zero with the screen
   idle. Review card f09 (Noah, 2026-10-01): an iPhone has no vibration from a web app,
   so the chime is the signal you notice there. */

let ctx: AudioContext | null = null;

function audioContextClass(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Open (or resume) the audio context. Call from a tap handler. */
export function primeChime(): void {
  try {
    const AC = audioContextClass();
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Two rising notes, about a third of a second. Silent until primed by a tap. */
export function playChime(): boolean {
  if (!ctx || ctx.state !== 'running') return false;
  try {
    const t = ctx.currentTime;
    note(ctx, 880, t, 0.14);
    note(ctx, 1318.5, t + 0.16, 0.22);
    return true;
  } catch {
    return false;
  }
}

function note(ac: AudioContext, freq: number, at: number, dur: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.22, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Test seam: forget the context so the next prime starts fresh. */
export function resetChimeForTests(): void {
  ctx = null;
}
