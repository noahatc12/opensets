// Persona check: three simulated users run real workouts on the built app, by touch, as the
// iPhone 14 Home Screen app. Every tap is counted, every step timed and photographed, and
// the words each screen shows are scanned for lifting jargon.
//
//   beginner  First open, the five questions, a whole first workout, then History.
//   noah      Two sets to failure at 6 to 12, built by hand as a two-day split (Push, Pull),
//             set 2 about 10% lighter, then the next session's prescription read back.
//   hurried   Sample data, one-tap sets, a typo noticed after the undo toast is gone, a cold
//             reopen mid-rest, leave and resume, skip an exercise, finish.
//
// Invariants (what a person must be able to do) fail the run; everything else is recorded as
// an observation for the review page. Output: .shots/personas/<persona>/NN-step.png and
// .shots/personas/report.json.
//
//   npm run build && npx vite preview --port 4175
//   SHOT_BASE=http://localhost:4175/opensets/ node scripts/persona-check.mjs
//   PERSONAS=noah limits the run.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const OUT = process.env.SHOT_OUT ?? '.shots/personas';
const ONLY = process.env.PERSONAS?.split(',');

// Terms a first-time lifter would have to look up. Case-sensitive where the term is an acronym.
const JARGON = [
  /\bRPE\b/,
  /\bAMRAP\b/,
  /\be1RM\b/i,
  /\bRIR\b/,
  /\bTempo\b/,
  /\b\d·\d·\d·\d\b/,
  /\b[Dd]eload\b/,
  /\bLinear\b/,
  /\bDouble\b/,
  /\bIntensification\b/i,
  /\bAccumulation\b/i,
  /\b[Mm]esocycle\b/,
  /\bFlags\b/,
  /\bRule\b/,
  /\bPR\b/,
];

const browser = await chromium.launch();
let prior = {};
try {
  prior = JSON.parse(readFileSync(`${OUT}/report.json`, 'utf8')).personas ?? {};
} catch {
  /* first run */
}
const report = {
  base: BASE,
  ranAt: new Date().toISOString(),
  personas: ONLY ? prior : {},
};
let failed = 0;

async function open(id) {
  const dir = `${OUT}/${id}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        'opensets-theme',
        JSON.stringify({ mode: 'dark', theme: 'signal', ds: 'editorial' }),
      );
    } catch {
      /* ignore */
    }
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      /display-mode:\s*standalone/.test(q)
        ? {
            matches: true,
            media: q,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent: () => false,
          }
        : orig(q);
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: {
      top: 47,
      topMax: 47,
      bottom: 34,
      bottomMax: 34,
      left: 0,
      leftMax: 0,
      right: 0,
      rightMax: 0,
    },
  });
  const p = (current = {
    id,
    page,
    ctx,
    dir,
    n: 0,
    taps: 0,
    t0: Date.now(),
    steps: [],
    fails: [],
    pending: [],
    notes: [],
    jargon: {},
    errors: [],
    celebrations: 0,
    marks: {},
  });
  page.on('pageerror', (e) => p.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') p.errors.push(m.text());
  });
  return p;
}

const settle = (p, ms = 450) => p.page.waitForTimeout(ms);
const secs = (p) => Math.round((Date.now() - p.t0) / 100) / 10;

async function shown(loc) {
  try {
    return await loc.first().isVisible();
  } catch {
    return false;
  }
}

/** One touch on the first visible match. Counts as a tap whether or not it did anything. */
async function tap(p, loc, what) {
  const el = loc.first();
  await el.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
  await el.tap({ timeout: 6000 });
  p.taps++;
  p.steps.push({ at: secs(p), tap: what });
  await settle(p);
  await dismissRecord(p);
}

/** A record screen covers everything; a person has to tap it away. */
async function dismissRecord(p) {
  const rec = p.page.getByRole('dialog', { name: 'New record' });
  if (await shown(rec)) {
    p.celebrations++;
    if (p.celebrations <= 2) await shot(p, `record-${p.celebrations}`);
    await rec.getByRole('button', { name: 'Keep going' }).tap();
    p.taps++;
    p.steps.push({ at: secs(p), tap: 'Keep going (record screen)' });
    await settle(p, 350);
  }
}

async function shot(p, name) {
  p.n++;
  const file = `${p.dir}/${String(p.n).padStart(2, '0')}-${name}.png`;
  await p.page.screenshot({ path: file });
  const text = await p.page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].filter(
      (x) => x.getBoundingClientRect().height > 0,
    );
    const root = d[d.length - 1] ?? document.querySelector('.os-shell');
    return root ? root.innerText : document.body.innerText;
  });
  for (const re of JARGON) {
    const m = text.match(re);
    if (m) (p.jargon[m[0]] ??= []).push(name);
  }
  p.steps.push({ at: secs(p), shot: file });
}

function check(p, ok, what, pending) {
  if (ok) p.steps.push({ at: secs(p), pass: what });
  else if (pending) p.pending.push(`${what} (waits on ${pending})`);
  else {
    p.fails.push(what);
    failed++;
  }
}
const note = (p, what) => p.notes.push(what);
const mark = (p, name) => (p.marks[name] = { taps: p.taps, at: secs(p) });
const since = (p, name) => ({
  taps: p.taps - p.marks[name].taps,
  sec: Math.round((secs(p) - p.marks[name].at) * 10) / 10,
});

/** Type a number on the logger's keypad: open it, press the digits, Set. */
async function keypad(p, which, value) {
  const page = p.page;
  await tap(
    p,
    page.getByRole('button', { name: `Type ${which}` }),
    `Type ${which}`,
  );
  const sheet = page.getByRole('dialog').last();
  for (const ch of String(value))
    await tap(
      p,
      sheet.getByRole('button', { name: ch, exact: true }),
      `key ${ch}`,
    );
  await tap(p, sheet.getByRole('button', { name: 'Set', exact: true }), 'Set');
}

/** What a finger at the control's centre would land on, after scrolling it as far into view
 *  as it goes: null when the control itself, else a short description of what covers it. */
async function coveredBy(loc) {
  return loc.first().evaluate((el) => {
    el.scrollIntoView({ block: 'end' });
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    if (!hit || el === hit || el.contains(hit)) return null;
    return (hit.closest('[role],[class]')?.textContent ?? hit.tagName)
      .trim()
      .slice(0, 40);
  });
}

async function loggerState(page) {
  if (await shown(page.getByRole('button', { name: 'Skip rest' })))
    return 'rest';
  if (await shown(page.getByRole('button', { name: /^Log set/ }))) return 'log';
  if (await shown(page.getByRole('button', { name: /^Next:/ }))) return 'next';
  if (await shown(page.getByRole('button', { name: 'Finish workout' })))
    return 'finish';
  return 'unknown';
}
const ctaText = (page) =>
  page
    .getByRole('button', { name: /^Log set/ })
    .first()
    .innerText();
const exerciseName = (page) => page.locator('h1').first().innerText();

async function pickExercise(p, query, pick) {
  const page = p.page;
  const search = page.getByRole('textbox', { name: 'Search exercises' });
  await tap(p, search, 'search field');
  await search.fill(query);
  p.taps += 1; // typing a query is at least one more touch sequence
  await settle(p, 500);
  const rows = page.getByRole('button', { name: /^Add / });
  const names = await rows.evaluateAll((els) =>
    els.slice(0, 5).map((e) => e.getAttribute('aria-label').slice(4)),
  );
  const idx = pick
    ? Math.max(
        0,
        names.findIndex((n) => pick.test(n)),
      )
    : 0;
  p.steps.push({
    at: secs(p),
    searched: query,
    top5: names,
    picked: names[idx],
  });
  await tap(p, rows.nth(idx), `pick ${names[idx]}`);
  return names[idx];
}

/** Step a builder Mini tile to a target value with its + and - buttons; returns taps used. */
async function stepTo(p, card, name, target, step = 1) {
  const tile = card
    .getByRole('button', { name: `Increase ${name}` })
    .locator('xpath=../..');
  const read = async () =>
    parseFloat((await tile.locator('.os-num').innerText()).trim());
  let v = await read();
  let used = 0;
  while (Math.abs(v - target) > 1e-6 && used < 80) {
    await tap(
      p,
      card.getByRole('button', {
        name: `${v < target ? 'Increase' : 'Decrease'} ${name}`,
      }),
      `${name} ${v < target ? '+' : '-'}`,
    );
    used++;
    const nv = await read();
    if (nv === v) break;
    v = nv;
  }
  void step;
  return { used, value: v };
}

// ---------------------------------------------------------------------------------------
// Beginner: someone who has a gym membership and has never followed a program.
async function beginner() {
  const p = await open('beginner');
  const { page } = p;
  await page.goto(BASE + '#/today');
  await settle(p, 1500);
  mark(p, 'start');
  await shot(p, 'first-open');

  await tap(
    p,
    page.getByRole('button', { name: /Build my plan/ }),
    'Build my plan',
  );
  await shot(p, 'q1-goal');
  await tap(p, page.getByRole('radio', { name: /Stay fit/ }), 'Stay fit');
  await tap(p, page.locator('.os-dock button'), 'Continue');
  await shot(p, 'q2-days');
  await tap(p, page.getByRole('radio', { name: '3', exact: true }), '3 days');
  await tap(p, page.locator('.os-dock button'), 'Continue');
  await shot(p, 'q3-experience');
  await tap(p, page.getByRole('radio', { name: /Novice/ }), 'Novice');
  await tap(p, page.locator('.os-dock button'), 'Continue');
  await shot(p, 'q4-numbers');
  await tap(
    p,
    page.locator('.os-dock button'),
    'Continue (skipped the numbers)',
  );
  await settle(p, 800);
  await shot(p, 'q5-plan');
  await tap(p, page.locator('.os-dock button'), 'Build my plan');
  await settle(p, 1200);
  await shot(p, 'today-with-plan');
  check(
    p,
    await shown(page.getByRole('button', { name: /Start workout/ })),
    'After onboarding, Today offers Start workout',
  );
  p.marks.onboarding = since(p, 'start');

  mark(p, 'workout');
  await tap(
    p,
    page.getByRole('button', { name: /Start workout/ }),
    'Start workout',
  );
  await settle(p, 800);
  await shot(p, 'logger-first');
  const why = page.locator('.os-why');
  if (await shown(why)) {
    await tap(p, why, 'WHY');
    await shot(p, 'logger-why-open');
    await tap(p, why, 'WHY (close)');
  }
  let firstSet = null;
  let sets = 0;
  let exercises = 1;
  let rests = 0;
  for (let guard = 0; guard < 80; guard++) {
    const st = await loggerState(page);
    if (st === 'log') {
      await tap(
        p,
        page.getByRole('button', { name: /^Log set/ }),
        await ctaText(page),
      );
      sets++;
      if (!firstSet) firstSet = since(p, 'start');
      if (sets === 1) await shot(p, 'rest-after-first-set');
    } else if (st === 'rest') {
      rests++;
      await tap(
        p,
        page.getByRole('button', { name: 'Skip rest' }),
        'Skip rest',
      );
    } else if (st === 'next') {
      exercises++;
      await tap(
        p,
        page.getByRole('button', { name: /^Next:/ }),
        'Next exercise',
      );
      if (exercises === 2) await shot(p, 'logger-second-exercise');
    } else if (st === 'finish') {
      await shot(p, 'last-set-done');
      await tap(
        p,
        page.getByRole('button', { name: 'Finish workout' }),
        'Finish workout',
      );
      break;
    } else {
      await shot(p, 'stuck');
      check(p, false, 'Logger reached a state with no way forward');
      break;
    }
  }
  await settle(p, 600);
  await shot(p, 'summary');
  await tap(
    p,
    page.getByRole('button', { name: 'Save workout' }),
    'Save workout',
  );
  await settle(p, 1200);
  await shot(p, 'today-after');
  p.marks.workout = { ...since(p, 'workout'), sets, exercises, rests };
  p.marks.firstSet = firstSet;
  check(p, sets > 0, 'Beginner logged a whole workout');
  const recent = page.getByText('Recent');
  check(p, await shown(recent), 'Today lists the workout under Recent');

  await tap(
    p,
    page.locator('.os-tabs').getByRole('link', { name: /Trends/ }),
    'Trends tab',
  );
  await settle(p, 800);
  await shot(p, 'history');
  return p;
}

// ---------------------------------------------------------------------------------------
// Noah: two sets to failure, 6 to 12 reps, set 2 about 10% lighter, a Push and a Pull day.
async function noah() {
  const p = await open('noah');
  const { page } = p;
  await page.goto(BASE + '#/today');
  await settle(p, 1500);

  mark(p, 'build');
  await tap(
    p,
    page.getByRole('button', { name: 'Build manually' }),
    'Build manually',
  );
  await settle(p, 700);
  await shot(p, 'builder-empty');
  const nameBox = page.getByRole('textbox', { name: 'Day name' });
  await tap(p, nameBox, 'Day name');
  await nameBox.fill('Push');
  const push = [
    ['incline dumbbell press', /Incline Dumbbell Press/i, 55],
    ['chest press machine', /Machine|Lever/i, 120],
    ['lateral raise', /Lateral Raise/i, 20],
  ];
  const buildTaps = [];
  for (const [q, re, start] of push) {
    const before = p.taps;
    await tap(
      p,
      page.getByRole('button', { name: '+ Add exercise' }),
      'Add exercise',
    );
    await settle(p, 600);
    if (buildTaps.length === 0) await shot(p, 'picker');
    const picked = await pickExercise(p, q, re);
    await settle(p, 500);
    const card = page.locator('.os-card').filter({ hasText: picked }).last();
    const rule = card.getByRole('radio', { name: 'Double' });
    if ((await rule.getAttribute('aria-checked')) !== 'true')
      await tap(p, rule, 'Double');
    const s = await stepTo(p, card, 'sets', 2);
    const lo = await stepTo(p, card, 'rep min', 6);
    const hi = await stepTo(p, card, 'rep max', 12);
    const w = await stepTo(p, card, 'starting weight', start);
    const r = await stepTo(p, card, 'rest', buildTaps.length === 2 ? 120 : 180);
    buildTaps.push({
      exercise: picked,
      taps: p.taps - before,
      sets: s,
      repMin: lo,
      repMax: hi,
      weight: w,
      rest: r,
    });
  }
  await shot(p, 'builder-push-filled');
  await tap(p, page.getByRole('button', { name: 'Save day' }), 'Save day');
  await settle(p, 1200);
  await shot(p, 'today-after-push');
  p.marks.buildPush = { ...since(p, 'build'), perExercise: buildTaps };

  // The second day of the split.
  await tap(
    p,
    page.locator('.os-tabs').getByRole('link', { name: /Plan/ }),
    'Plan tab',
  );
  await settle(p, 800);
  await shot(p, 'plan-one-day');
  await tap(p, page.getByRole('button', { name: '+ New day' }), '+ New day');
  await settle(p, 700);
  const nameBox2 = page.getByRole('textbox', { name: 'Day name' });
  await tap(p, nameBox2, 'Day name');
  await nameBox2.fill('Pull');
  for (const [q, re, start] of [
    ['lat pulldown', /Pulldown/i, 120],
    ['seated cable row', /Row/i, 110],
  ]) {
    await tap(
      p,
      page.getByRole('button', { name: '+ Add exercise' }),
      'Add exercise',
    );
    await settle(p, 600);
    const picked = await pickExercise(p, q, re);
    await settle(p, 500);
    const card = page.locator('.os-card').filter({ hasText: picked }).last();
    const rule = card.getByRole('radio', { name: 'Double' });
    if ((await rule.getAttribute('aria-checked')) !== 'true')
      await tap(p, rule, 'Double');
    await stepTo(p, card, 'sets', 2);
    await stepTo(p, card, 'rep min', 6);
    await stepTo(p, card, 'rep max', 12);
    await stepTo(p, card, 'starting weight', start);
    await stepTo(p, card, 'rest', 180);
  }
  await tap(p, page.getByRole('button', { name: 'Save day' }), 'Save day');
  await settle(p, 1200);
  await tap(
    p,
    page.locator('.os-tabs').getByRole('link', { name: /Plan/ }),
    'Plan tab',
  );
  await settle(p, 800);
  await shot(p, 'plan-after-second-day');
  const planText = await page.locator('main').innerText();
  const bothDays =
    /Push/.test(planText) &&
    /Pull/.test(planText) &&
    !/Your programs/.test(planText);
  const dayCards = await page
    .getByRole('button', { name: /exercises$/ })
    .count();
  p.steps.push({ at: secs(p), planDayCards: dayCards });
  check(p, dayCards >= 2, '+ New day adds a second day to the same plan');
  if (dayCards < 2)
    note(
      p,
      `Plan after "+ New day": ${dayCards} day card(s); both names on screen: ${bothDays}.`,
    );

  // Train Push: set 1 to failure at 12, set 2 about 10% lighter to failure at 9.
  await tap(
    p,
    page.locator('.os-tabs').getByRole('link', { name: /Today/ }),
    'Today tab',
  );
  await settle(p, 800);
  await shot(p, 'today-before-train');
  const heroName = await page.locator('h2').first().innerText();
  if (!/Push/.test(heroName)) {
    // Today points at another day; open Plan and start Push from there if it exists.
    note(p, `Today's up next is "${heroName}", not Push.`);
  }
  await tap(
    p,
    page.getByRole('button', { name: /Start workout/ }),
    'Start workout',
  );
  await settle(p, 900);
  await shot(p, 'logger-first');
  const perSet = [];
  const first = await exerciseName(page);
  const cta1 = await ctaText(page);
  // Set 1: whatever weight is staged, 12 reps, effort 10.
  mark(p, 'set');
  await keypad(p, 'reps', 12);
  await tap(
    p,
    page
      .getByRole('group', { name: 'RPE' })
      .getByRole('button', { name: '10' }),
    'RPE 10',
  );
  await shot(p, 'set1-staged');
  await tap(
    p,
    page.getByRole('button', { name: /^Log set/ }),
    await ctaText(page),
  );
  perSet.push({ set: 1, ...since(p, 'set') });
  await shot(p, 'rest-after-set1');
  const restLabel = await page
    .getByRole('img', { name: /rest$/ })
    .getAttribute('aria-label')
    .catch(() => null);
  p.steps.push({ at: secs(p), restShown: restLabel });
  await tap(p, page.getByRole('button', { name: 'Skip rest' }), 'Skip rest');
  // Set 2: about 10% lighter, 9 reps, effort 10.
  const cta2 = await ctaText(page);
  const staged2 = parseFloat(cta2.match(/·\s*([\d.]+)/)?.[1] ?? '0');
  const lighter = Math.round((staged2 * 0.9) / 2.5) * 2.5;
  mark(p, 'set');
  await keypad(p, 'weight', lighter);
  await keypad(p, 'reps', 9);
  await tap(
    p,
    page
      .getByRole('group', { name: 'RPE' })
      .getByRole('button', { name: '10' }),
    'RPE 10',
  );
  await shot(p, 'set2-staged');
  const cta2b = await ctaText(page);
  await tap(p, page.getByRole('button', { name: /^Log set/ }), cta2b);
  perSet.push({ set: 2, staged: cta2, logged: cta2b, ...since(p, 'set') });
  await shot(p, 'after-set2');
  if (await shown(page.getByRole('button', { name: 'Skip rest' })))
    await tap(p, page.getByRole('button', { name: 'Skip rest' }), 'Skip rest');
  await shot(p, 'exercise-done');
  p.marks.failureSets = { exercise: first, staged1: cta1, perSet };
  check(
    p,
    Math.abs(staged2 - parseFloat(cta1.match(/·\s*([\d.]+)/)?.[1] ?? '0')) >
      0.01,
    'Set 2 is staged lighter than set 1 (Noah runs set 2 about 10% lighter)',
    'the failure core, d04b',
  );

  // Finish, then read what the app prescribes next time for the same exercise.
  await tap(
    p,
    page.getByRole('button', { name: 'Finish', exact: true }),
    'Finish (top bar)',
  );
  await settle(p, 600);
  await shot(p, 'summary');
  await tap(
    p,
    page.getByRole('button', { name: 'Save workout' }),
    'Save workout',
  );
  await settle(p, 1200);
  await shot(p, 'today-after-save');
  await tap(
    p,
    page.locator('.os-tabs').getByRole('link', { name: /Plan/ }),
    'Plan tab',
  );
  await settle(p, 800);
  const pushCard = page.getByRole('button', { name: /^Push, / });
  if (await shown(pushCard)) {
    await tap(p, pushCard, 'open Push');
    const startBtn = page.getByRole('button', {
      name: /^Start this day instead$|^Start$/,
    });
    await tap(p, startBtn, 'Start Push again');
    await settle(p, 900);
    await shot(p, 'next-session-logger');
    const next1 = await ctaText(page).catch(() => '');
    const whyText = await page
      .locator('.os-why')
      .innerText()
      .catch(() => '');
    p.marks.nextSession = { cta: next1, why: whyText };
    await tap(p, page.locator('.os-why'), 'WHY');
    await shot(p, 'next-session-why');
  } else {
    note(p, 'Could not find the Push day on Plan after saving the workout.');
  }
  return p;
}

// ---------------------------------------------------------------------------------------
// Hurried: logs between sets with one thumb, notices a typo late, gets interrupted.
async function hurried() {
  const p = await open('hurried');
  const { page } = p;
  await page.goto(BASE + '#/today');
  await settle(p, 1500);
  await tap(
    p,
    page.getByRole('button', { name: 'Load sample data' }),
    'Load sample data',
  );
  await settle(p, 1500);
  await shot(p, 'today-sample');
  mark(p, 'start');
  await tap(
    p,
    page.getByRole('button', { name: /Start workout/ }),
    'Start workout',
  );
  await settle(p, 800);
  await shot(p, 'logger');

  // Set 1 exactly as staged: one tap.
  mark(p, 'set1');
  await tap(
    p,
    page.getByRole('button', { name: /^Log set/ }),
    await ctaText(page),
  );
  p.marks.oneTapSet = since(p, 'set1');
  await tap(p, page.getByRole('button', { name: 'Skip rest' }), 'Skip rest');

  // Set 2 with a slip of the thumb: one rep too many, noticed after the toast has gone.
  await tap(
    p,
    page.getByRole('button', { name: 'increase reps' }),
    'reps + (slip)',
  );
  const slipped = await ctaText(page);
  await tap(p, page.getByRole('button', { name: /^Log set/ }), slipped);
  await page.waitForTimeout(10_500);
  await shot(p, 'typo-noticed');
  const slipRow = page
    .locator('.os-row')
    .filter({
      hasText: slipped.replace(/^Log set \d+ · /, '').replace(' × ', '×'),
    })
    .first();
  const rowText = await page.locator('.os-row').allInnerTexts();
  p.steps.push({ at: secs(p), rows: rowText.slice(0, 4) });
  const dialogsBefore = await page.getByRole('dialog').count();
  await page
    .locator('.os-row')
    .nth(1)
    .tap({ timeout: 3000 })
    .catch(() => {});
  p.taps++;
  await settle(p, 600);
  const dialogsAfter = await page.getByRole('dialog').count();
  void slipRow;
  check(
    p,
    dialogsAfter > dialogsBefore,
    'A logged set can be corrected after the undo toast is gone (tap the set)',
    'review f07, edit a logged set',
  );
  await shot(p, 'typo-tap-result');

  // Cold reopen in the middle of a rest.
  if (!(await shown(page.getByRole('button', { name: 'Skip rest' })))) {
    if ((await loggerState(page)) === 'log')
      await tap(
        p,
        page.getByRole('button', { name: /^Log set/ }),
        await ctaText(page),
      );
  }
  const restBefore = await page
    .locator('.os-sheet .os-num')
    .first()
    .innerText()
    .catch(() => '');
  const exBefore = await exerciseName(page);
  await page.reload();
  await settle(p, 2000);
  await shot(p, 'after-cold-reopen');
  const exAfter = await exerciseName(page).catch(() => '');
  const restAfter = await page
    .locator('.os-sheet .os-num')
    .first()
    .innerText()
    .catch(() => '');
  check(
    p,
    exAfter === exBefore,
    `Cold reopen lands on the same exercise (${exBefore})`,
  );
  check(
    p,
    restAfter !== '',
    `Cold reopen keeps the rest timer running (was ${restBefore}, now ${restAfter || 'gone'})`,
  );
  if (await shown(page.getByRole('button', { name: 'Skip rest' })))
    await tap(p, page.getByRole('button', { name: 'Skip rest' }), 'Skip rest');

  // Leave for a moment, come back.
  await tap(
    p,
    page.getByRole('button', { name: /Leave workout/ }),
    'Leave (chevron)',
  );
  await settle(p, 800);
  await shot(p, 'today-left');
  const resume = page.getByRole('button', {
    name: 'Resume workout in progress',
  });
  check(p, await shown(resume), 'Today offers Resume after leaving');
  await tap(p, resume, 'Resume');
  await settle(p, 800);

  // Move to exercise 2, log one set, then skip that exercise.
  if ((await loggerState(page)) === 'log') {
    await tap(
      p,
      page.getByRole('button', { name: 'Next exercise' }),
      'Next exercise (strip arrow)',
    );
  }
  const ex2 = await exerciseName(page);
  await tap(
    p,
    page.getByRole('button', { name: /^Log set/ }),
    await ctaText(page),
  );
  if (await shown(page.getByRole('button', { name: 'Skip rest' })))
    await tap(p, page.getByRole('button', { name: 'Skip rest' }), 'Skip rest');
  const chipsBefore = await page.locator('.os-chips button').count();
  const skipBtn = page
    .getByRole('button', { name: 'Skip', exact: true })
    .first();
  const cover = await coveredBy(skipBtn);
  check(
    p,
    cover === null,
    `Swap, Skip and Add can be tapped right after logging a set (covered by "${cover}")`,
  );
  if (cover) {
    await shot(p, 'skip-covered');
    await page.waitForTimeout(10_500);
  }
  await tap(p, skipBtn, 'Skip (exercise row)');
  await shot(p, 'after-skip');
  const chipsAfter = await page.locator('.os-chips button').count();
  const undoOffered = await shown(page.getByRole('button', { name: 'Undo' }));
  p.steps.push({
    at: secs(p),
    skip: { exercise: ex2, chipsBefore, chipsAfter, undoOffered },
  });
  check(
    p,
    undoOffered || chipsAfter === chipsBefore,
    `Skip on ${ex2} (1 set logged) can be undone`,
  );

  await tap(
    p,
    page.getByRole('button', { name: 'Finish', exact: true }),
    'Finish (top bar)',
  );
  await settle(p, 600);
  await shot(p, 'summary');
  const summary = await page.locator('main').innerText();
  check(
    p,
    summary.includes(ex2.split(' ')[0]),
    `Summary still shows the set logged on ${ex2} before it was skipped`,
  );
  await tap(
    p,
    page.getByRole('button', { name: 'Save workout' }),
    'Save workout',
  );
  await settle(p, 1200);
  await shot(p, 'today-after');
  p.marks.total = since(p, 'start');
  return p;
}

const RUNS = { beginner, noah, hurried };
let current = null;
for (const [id, fn] of Object.entries(RUNS)) {
  if (ONLY && !ONLY.includes(id)) continue;
  let p;
  try {
    p = await fn();
  } catch (e) {
    failed++;
    const trail = current?.steps?.slice(-6) ?? [];
    if (current?.page)
      await current.page
        .screenshot({ path: `${current.dir}/zz-crash.png` })
        .catch(() => {});
    report.personas[id] = {
      crashed: String(e.message ?? e).slice(0, 400),
      trail,
    };
    console.log(JSON.stringify(trail));
    console.log(`${id}: CRASHED ${String(e.message ?? e).split('\n')[0]}`);
    continue;
  }
  const { page, ctx, dir, ...rest } = p;
  void page;
  void dir;
  report.personas[id] = rest;
  await ctx.close();
  console.log(
    `${id}: ${p.taps} taps, ${secs(p)} s, ${p.fails.length} failed, ${p.celebrations} record screens, jargon: ${Object.keys(p.jargon).join(' ') || 'none'}`,
  );
  for (const f of p.fails) console.log(`  FAIL ${f}`);
  for (const f of p.pending) console.log(`  pending ${f}`);
  for (const n of p.notes) console.log(`  note ${n}`);
  for (const e of p.errors.slice(0, 5))
    console.log(`  error ${e.slice(0, 160)}`);
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(
  `\n${failed === 0 ? 'all invariants held' : `${failed} invariant(s) failed`}; ${OUT}/report.json`,
);
process.exit(failed === 0 ? 0 : 1);
