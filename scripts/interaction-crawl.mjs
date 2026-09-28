// Interaction crawl: every button on every screen, pressed, and what it did written down
// (Noah, 09-28: "every single button pressed, like what does it do and does it actually
// make sense"). Step 2 of the plan at https://claude.ai/artifact/6SybR8y9558eyVS6u6ZadG.
//
// For each starting state (a screen, a pop-up, a moment in a workout) the crawl lists every
// control a person can see in the top layer. For each control it builds a fresh copy of
// that state, presses the control once, and records what changed: the screen, the pop-ups,
// saved data, focus, the words on screen, errors, plus a picture. A control that changes
// nothing is flagged, as is an error. Runs as the iPhone 14 Home Screen app, by touch, in
// parallel workers.
//
//   npm run build && npx vite preview --port 4175
//   SHOT_BASE=http://localhost:4175/opensets/ node scripts/interaction-crawl.mjs
//   CRAWL_ONLY=log,plan limits the states; CRAWL_WORKERS=4 sets the parallelism.
// Output: .shots/crawl/crawl.json and one picture per press (.shots/crawl/<state>/).
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const OUT = process.env.SHOT_OUT ?? '.shots/crawl';
const ONLY = process.env.CRAWL_ONLY?.split(',');
const WORKERS = Number(process.env.CRAWL_WORKERS ?? 4);

const browser = await chromium.launch();

// ---------------------------------------------------------------------------------------
// A fresh app, seeded, with the helpers the state recipes use.
async function fresh(seed) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
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
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  await page.goto(BASE + '#/today');
  await page.waitForTimeout(1100);
  const h = {
    page,
    ctx,
    errors,
    async tap(loc) {
      await loc
        .first()
        .scrollIntoViewIfNeeded({ timeout: 4000 })
        .catch(() => {});
      await loc.first().tap({ timeout: 6000 });
      await page.waitForTimeout(550);
      const rec = page.getByRole('dialog', { name: 'New record' });
      if (await rec.isVisible().catch(() => false)) {
        await rec.getByRole('button', { name: 'Keep going' }).tap();
        await page.waitForTimeout(350);
      }
    },
    btn: (name) => page.getByRole('button', { name }),
    tab: (name) => h.tap(page.locator('.os-tabs').getByRole('link', { name })),
    async openDay(n) {
      const c = page.getByRole('button', { name: new RegExp(`^${n}, `) });
      if ((await c.getAttribute('aria-expanded')) !== 'true') await h.tap(c);
    },
  };
  if (seed === 'sample') await h.tap(h.btn('Load sample data'));
  return h;
}

// ---------------------------------------------------------------------------------------
// Starting states. Each is reached the way a person would, so every pushed screen has its
// real origin and Back has somewhere true to go.
const S = [];
const state = (id, seed, recipe) => S.push({ id, seed, recipe });

state('today-empty', 'empty', async () => {});
state('today', 'sample', async () => {});
state('plan', 'sample', async (h) => h.tab('Plan'));
state('plan-pull-open', 'sample', async (h) => {
  await h.tab('Plan');
  await h.openDay('Pull');
});
state('builder-new-day', 'sample', async (h) => {
  await h.tab('Plan');
  await h.tap(h.btn('+ New day'));
});
state('builder-edit-push', 'sample', async (h) => {
  await h.tab('Plan');
  await h.openDay('Push');
  await h.tap(h.btn('Edit Push'));
});
state('sheet-exercise-picker', 'sample', async (h) => {
  await h.tab('Plan');
  await h.tap(h.btn('+ New day'));
  await h.tap(h.btn('+ Add exercise'));
});
state('library', 'sample', async (h) => h.tab('Library'));
state('sheet-filters', 'sample', async (h) => {
  await h.tab('Library');
  await h.tap(h.btn(/^Filters/));
});
state('exercise-detail', 'sample', async (h) => {
  await h.tab('Library');
  await h.tap(h.btn(/e1RM/));
});
state('trends', 'sample', async (h) => h.tab('Trends'));
state('you', 'sample', async (h) => h.tab('You'));
state('sheet-erase', 'sample', async (h) => {
  await h.tab('You');
  await h.tap(h.btn(/Erase all data/));
});
for (const [id, label] of [
  ['plates', /Plates|Bar and plates/],
  ['rest-defaults', /Rest/],
  ['profile', /Profile/],
  ['goals', /Goals/],
  ['measurements', /Measurements/],
])
  state(id, 'sample', async (h) => {
    await h.tab('You');
    await h.tap(h.btn(label));
  });
state('sheet-new-goal', 'sample', async (h) => {
  await h.tab('You');
  await h.tap(h.btn(/Goals/));
  await h.tap(h.btn(/New goal/).last());
});
state('sheet-log-measurement', 'sample', async (h) => {
  await h.tab('You');
  await h.tap(h.btn(/Measurements/));
  await h.tap(h.btn(/Log measurement/).last());
});
for (let i = 1; i <= 5; i++)
  state(`onboarding-${i}`, 'empty', async (h) => {
    await h.tap(h.btn(/Build my plan/));
    for (let j = 1; j < i; j++) await h.tap(h.page.locator('.os-dock button'));
  });
state('workout', 'sample', async (h) => {
  await h.tap(h.btn(/Start workout/));
});
state('sheet-keypad', 'sample', async (h) => {
  await h.tap(h.btn(/Start workout/));
  await h.tap(h.btn('Type weight'));
});
state('sheet-plate-math', 'sample', async (h) => {
  await h.tap(h.btn(/Start workout/));
  await h.tap(h.btn(/Per side/));
});
state('sheet-swap-picker', 'sample', async (h) => {
  await h.tap(h.btn(/Start workout/));
  await h.tap(h.btn('Swap'));
});
state('workout-rest', 'sample', async (h) => {
  await h.tap(h.btn(/Start workout/));
  await h.tap(h.btn(/^Log set/));
});
state('workout-summary', 'sample', async (h) => {
  await h.tap(h.btn(/Start workout/));
  await h.tap(h.btn(/^Log set/));
  await h.tap(h.page.getByRole('button', { name: 'Finish', exact: true }));
});
state('sheet-discard', 'sample', async (h) => {
  await h.tap(h.btn(/Start workout/));
  await h.tap(h.btn(/^Log set/));
  await h.tap(h.page.getByRole('button', { name: 'Finish', exact: true }));
  await h.tap(h.btn('Discard'));
});
state('workout-tucked-library', 'sample', async (h) => {
  await h.tap(h.btn(/Start workout/));
  await h.tap(h.btn(/Leave workout/));
  await h.tab('Library');
});

// ---------------------------------------------------------------------------------------
// In the page: the controls in the top layer, and a fingerprint of everything observable.
const CONTROLS = () => {
  const Q =
    'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="radio"], [role="switch"], [role="tab"], [role="link"]';
  const dialogs = [
    ...document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
  ].filter((d) => d.getBoundingClientRect().height > 0);
  const top = dialogs[dialogs.length - 1] ?? null;
  const cover = document.querySelector('.os-cover');
  const scope =
    top ?? cover ?? document.querySelector('.os-shell') ?? document.body;
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (
      el.closest(
        '[inert], [aria-hidden="true"], .os-pushed-parent, .os-feel, .os-feel-pill, .sr-only',
      )
    )
      return false;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity) === 0) return false;
    }
    // Clipped out of a closed accordion.
    for (let a = el.parentElement; a; a = a.parentElement) {
      const st = getComputedStyle(a);
      if (/(hidden|clip)/.test(st.overflowY)) {
        const ar = a.getBoundingClientRect();
        if (r.bottom <= ar.top + 1 || r.top >= ar.bottom - 1) return false;
      }
    }
    return true;
  };
  const els = [...scope.querySelectorAll(Q)].filter(shown);
  if (!top && !cover)
    for (const e of document.querySelectorAll('.os-tabs a, .os-workout-bar'))
      if (shown(e) && !els.includes(e)) els.push(e);
  return els.map((el, i) => {
    el.dataset.crawl = String(i);
    const name = (
      el.getAttribute('aria-label') ||
      el.textContent ||
      el.getAttribute('placeholder') ||
      el.tagName
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 70);
    return {
      i,
      name,
      tag: el.tagName.toLowerCase(),
      disabled:
        el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      // Already chosen: pressing it again rightly changes nothing.
      selected:
        el.getAttribute('aria-pressed') === 'true' ||
        el.getAttribute('aria-checked') === 'true' ||
        el.getAttribute('aria-current') === 'page',
    };
  });
};

const OBSERVE = async () => {
  const dialogs = [
    ...document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
  ]
    .filter((d) => d.getBoundingClientRect().height > 0)
    .map((d) => d.getAttribute('aria-label') || 'pop-up');
  const cover = Boolean(document.querySelector('.os-cover'));
  const layer =
    [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
      .filter((d) => d.getBoundingClientRect().height > 0)
      .pop() ??
    document.querySelector('.os-cover') ??
    document.querySelector('.os-shell main');
  const text = (layer?.innerText ?? '').replace(/\d+:\d\d/g, '#:##');
  const heading =
    (
      document.querySelector('.os-cover h1') ??
      document.querySelector('main h1')
    )?.textContent
      ?.trim()
      .slice(0, 40) ?? '';
  // Focus matters only for fields (a tapped button always takes focus).
  const active = document.activeElement;
  const focus =
    active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)
      ? active.getAttribute('aria-label') ||
        active.getAttribute('placeholder') ||
        active.tagName.toLowerCase()
      : '';
  const toast = document.querySelector('.os-toast')?.textContent?.trim() ?? '';
  // Every toggle on the page, so a press that opens a day or selects a chip says so.
  const toggles = [
    ...document.querySelectorAll(
      '[aria-expanded], [aria-pressed], [aria-checked]',
    ),
  ]
    .map(
      (e) =>
        `${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)}=${e.getAttribute('aria-expanded') ?? e.getAttribute('aria-pressed') ?? e.getAttribute('aria-checked')}`,
    )
    .join('|');
  const root =
    document.querySelector('.os-cover') ??
    document.querySelector('.os-shell main');
  const sc = root
    ? [root, ...root.querySelectorAll('*')].find(
        (e) =>
          e.scrollHeight > e.clientHeight + 4 &&
          /(auto|scroll)/.test(getComputedStyle(e).overflowY),
      )
    : null;
  const scroll = sc ? Math.round(sc.scrollTop) : 0;
  // Saved data: every object store's row count and a length signature.
  const data = {};
  const dbs = (await indexedDB.databases?.()) ?? [];
  for (const d of dbs) {
    // The app's own data only; the service worker keeps its cache bookkeeping apart.
    if (d.name !== 'opensets-lb') continue;
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(d.name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    for (const store of db.objectStoreNames) {
      const rows = await new Promise((res) => {
        const tx = db.transaction(store, 'readonly');
        const q = tx.objectStore(store).getAll();
        q.onsuccess = () => res(q.result);
        q.onerror = () => res([]);
      });
      // A real hash: a rest time from 180 to 195 keeps the JSON the same length.
      const json = JSON.stringify(rows);
      let hash = 5381;
      for (let k = 0; k < json.length; k++)
        hash = ((hash << 5) + hash + json.charCodeAt(k)) | 0;
      data[store] = `${rows.length}:${hash}`;
    }
    db.close();
  }
  return {
    route: location.hash.replace(/^#/, ''),
    dialogs,
    cover,
    heading,
    text,
    focus,
    toast,
    toggles,
    scroll,
    data,
  };
};

/** What a press did, in words. */
function describe(before, after, stateId) {
  const said = [];
  if (after.route !== before.route)
    said.push(`goes to ${after.heading || after.route} (${after.route})`);
  if (after.cover && !before.cover) said.push('opens the workout');
  if (!after.cover && before.cover) said.push('closes the workout');
  const opened = after.dialogs.filter((d) => !before.dialogs.includes(d));
  const closed = before.dialogs.filter((d) => !after.dialogs.includes(d));
  if (opened.length) said.push(`opens ${opened.join(', ')}`);
  if (closed.length) said.push(`closes ${closed.join(', ')}`);
  const wrote = Object.keys({ ...before.data, ...after.data }).filter(
    (k) => before.data[k] !== after.data[k],
  );
  if (wrote.length) said.push(`saves to ${wrote.join(', ')}`);
  if (after.toast && after.toast !== before.toast)
    said.push(`says "${after.toast}"`);
  if (after.focus && after.focus !== before.focus)
    said.push(`focuses ${after.focus}`);
  if (after.toggles !== before.toggles) {
    const b = new Map(before.toggles.split('|').map((x) => x.split('=')));
    const changed = after.toggles
      .split('|')
      .map((x) => x.split('='))
      .filter(([k, v]) => b.has(k) && b.get(k) !== v)
      .map(([k, v]) => `${v === 'true' ? 'turns on' : 'turns off'} ${k}`);
    if (changed.length) said.push(changed.slice(0, 3).join(', '));
  }
  if (!said.length && Math.abs(after.scroll - before.scroll) > 20)
    said.push(`scrolls (${before.scroll} to ${after.scroll})`);
  if (!said.length && after.text !== before.text)
    said.push('changes what the screen shows');
  void stateId;
  return { said, wrote, dead: said.length === 0 };
}

// ---------------------------------------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const jobs = [];
const states = [];
const log = (s) => process.stdout.write(s + '\n');

// Pass 1: each state once, for its control list and its picture.
for (const s of S) {
  if (ONLY && !ONLY.includes(s.id)) continue;
  const h = await fresh(s.seed);
  try {
    await s.recipe(h);
    await h.page.waitForTimeout(500);
    const controls = await h.page.evaluate(CONTROLS);
    mkdirSync(`${OUT}/${s.id}`, { recursive: true });
    await h.page.screenshot({
      path: `${OUT}/${s.id}/_state.jpg`,
      type: 'jpeg',
      quality: 70,
    });
    const route = await h.page.evaluate(() => location.hash);
    states.push({ id: s.id, route, controls, errors: [...h.errors] });
    for (const c of controls) if (!c.disabled) jobs.push({ s, c });
    log(`state ${s.id}: ${controls.length} controls (${route})`);
  } catch (e) {
    states.push({ id: s.id, broken: String(e.message).split('\n')[0] });
    log(`state ${s.id}: COULD NOT REACH ${String(e.message).split('\n')[0]}`);
  }
  await h.ctx.close();
}

// Pass 2: every control, pressed in a fresh copy of its state.
const presses = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { s, c } = jobs[next++];
    const h = await fresh(s.seed);
    const rec = {
      state: s.id,
      i: c.i,
      name: c.name,
      tag: c.tag,
      selected: c.selected,
    };
    try {
      await s.recipe(h);
      await h.page.waitForTimeout(400);
      const now = await h.page.evaluate(CONTROLS);
      const same = now.find((x) => x.i === c.i);
      if (!same || same.name !== c.name) {
        rec.skipped = `the state came back different (${same?.name ?? 'missing'})`;
      } else {
        const before = await h.page.evaluate(OBSERVE);
        const errs = h.errors.length;
        await h.page
          .locator(`[data-crawl="${c.i}"]`)
          .tap({ timeout: 4000 })
          .catch(async () => {
            rec.blocked = 'could not be tapped where it is drawn';
            await h.page
              .locator(`[data-crawl="${c.i}"]`)
              .click({ force: true });
          });
        await h.page.waitForTimeout(900);
        const after = await h.page.evaluate(OBSERVE);
        Object.assign(rec, describe(before, after, s.id));
        rec.errors = h.errors.slice(errs);
        await h.page.screenshot({
          path: `${OUT}/${s.id}/${String(c.i).padStart(2, '0')}.jpg`,
          type: 'jpeg',
          quality: 60,
        });
      }
    } catch (e) {
      rec.failed = String(e.message).split('\n')[0].slice(0, 160);
    }
    presses.push(rec);
    const flag = rec.failed
      ? 'FAILED'
      : rec.skipped
        ? 'SKIP'
        : rec.errors?.length
          ? 'ERROR'
          : rec.dead
            ? 'NOTHING'
            : 'ok';
    log(
      `${flag.padEnd(7)} ${s.id} #${c.i} "${c.name}": ${rec.said?.join('; ') ?? rec.failed ?? rec.skipped}`,
    );
    await h.ctx.close();
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await browser.close();

presses.sort((a, b) => a.state.localeCompare(b.state) || a.i - b.i);
const flagged = presses.filter(
  (p) => p.dead || p.errors?.length || p.failed || p.blocked,
);
writeFileSync(
  `${OUT}/crawl.json`,
  JSON.stringify(
    { base: BASE, ranAt: new Date().toISOString(), states, presses },
    null,
    2,
  ),
);
log(
  `\n${states.length} states, ${presses.length} presses; ${flagged.length} flagged (nothing happened, error, or blocked); ${OUT}/crawl.json`,
);
