// Navigation check: every way into a screen, and every way back out, against the rules in
// docs/redesign/NAV.md (Noah, 09-28: "does it make sense to reset this page or does it make
// sense to go back and it goes to this page ... I need that to be tested and thorough").
//
// Each case starts from a fresh app (empty, or with sample data), sets a place worth
// keeping (a scroll, an open day, a typed edit), navigates, comes back by the Back button
// and by the edge swipe, and asserts where it landed and what it kept. Runs as the iPhone 14
// Home Screen app, by touch. Prints every case, then exits non-zero if any failed.
//
//   npm run build && npx vite preview --port 4175
//   SHOT_BASE=http://localhost:4175/opensets/ node scripts/nav-check.mjs
//   NAV_ONLY=T07,T10 limits the run.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const OUT = process.env.SHOT_OUT ?? '.shots/nav';
const ONLY = process.env.NAV_ONLY?.split(',');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];

async function fresh(seed) {
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
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // React logs an error an error boundary caught; a swallowed crash must still fail.
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  await page.goto(BASE + '#/today');
  await page.waitForTimeout(1200);
  if (seed === 'sample') {
    await page.getByRole('button', { name: 'Load sample data' }).tap();
    await page.waitForTimeout(1500);
  }
  const t = {
    page,
    ctx,
    errors,
    async tap(loc) {
      await loc
        .first()
        .scrollIntoViewIfNeeded({ timeout: 4000 })
        .catch(() => {});
      await loc.first().tap({ timeout: 5000 });
      await page.waitForTimeout(550);
      const rec = page.getByRole('dialog', { name: 'New record' });
      if (await rec.isVisible().catch(() => false)) {
        await rec.getByRole('button', { name: 'Keep going' }).tap();
        await page.waitForTimeout(400);
      }
    },
    async tab(name) {
      await t.tap(page.locator('.os-tabs').getByRole('link', { name }));
    },
    async back() {
      await t.tap(page.getByRole('button', { name: 'Back', exact: true }));
    },
    /** A finger from the left edge across most of the screen. */
    async swipe() {
      const y = 420;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 6, y }],
      });
      for (let i = 1; i <= 14; i++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 6 + (300 * i) / 14, y }],
        });
        await page.waitForTimeout(18);
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await page.waitForTimeout(900);
    },
    route: () => page.evaluate(() => location.hash.replace(/^#/, '') || '/'),
    scrollTop: () =>
      page.evaluate(() => {
        const s = [...document.querySelectorAll('main *')].find(
          (e) =>
            e.scrollHeight > e.clientHeight + 4 &&
            /(auto|scroll)/.test(getComputedStyle(e).overflowY),
        );
        return s ? Math.round(s.scrollTop) : 0;
      }),
    scrollTo: (y) =>
      page.evaluate((y) => {
        const s = [...document.querySelectorAll('main *')].find(
          (e) =>
            e.scrollHeight > e.clientHeight + 4 &&
            /(auto|scroll)/.test(getComputedStyle(e).overflowY),
        );
        if (s) {
          s.scrollTop = y;
          s.dispatchEvent(new Event('scroll'));
        }
      }, y),
    /** The day card on Plan that is expanded (its Start button is showing). */
    openDay: () =>
      page.evaluate(() => {
        const c = [...document.querySelectorAll('[aria-expanded="true"]')];
        return c
          .map((b) => b.getAttribute('aria-label')?.split(',')[0])
          .join('|');
      }),
    heroTitle: () =>
      page
        .locator('h2')
        .first()
        .innerText()
        .catch(() => ''),
    shot: (name) => page.screenshot({ path: `${OUT}/${name}.png` }),
  };
  return t;
}

async function run(id, rule, title, seed, body) {
  if (ONLY && !ONLY.includes(id)) return;
  const t = await fresh(seed);
  const checks = [];
  const expect = (ok, what) => checks.push({ ok: Boolean(ok), what });
  try {
    await body(t, expect);
  } catch (e) {
    checks.push({
      ok: false,
      what: `stopped: ${String(e.message).split('\n')[0]}`,
    });
    await t.shot(`${id}-stopped`).catch(() => {});
  }
  if (t.errors.length)
    checks.push({ ok: false, what: `page errors: ${t.errors[0]}` });
  await t.ctx.close();
  const ok = checks.length > 0 && checks.every((c) => c.ok);
  results.push({ id, rule, title, ok, checks });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id} [${rule}] ${title}`);
  for (const c of checks) if (!c.ok) console.log(`        x ${c.what}`);
}

const LIB_Y = 3000;

// R1 and R2: back returns to where you came from, as you left it.
await run(
  'T01',
  'R1 R2',
  'Library, open an exercise, Back: same place in the list',
  'empty',
  async (t, expect) => {
    await t.tab('Library');
    await t.scrollTo(LIB_Y);
    await t.page.waitForTimeout(400);
    await t.page.touchscreen.tap(195, 460);
    await t.page.waitForTimeout(700);
    expect(
      (await t.route()).startsWith('/library/'),
      `opened an exercise (${await t.route()})`,
    );
    await t.back();
    expect(
      (await t.route()) === '/library',
      `Back lands on Library (${await t.route()})`,
    );
    const y = await t.scrollTop();
    expect(
      Math.abs(y - LIB_Y) < 80,
      `list kept its place (${y}, was ${LIB_Y})`,
    );
  },
);

await run(
  'T02',
  'R1 R2',
  'Library, open an exercise, edge swipe: same place in the list',
  'empty',
  async (t, expect) => {
    await t.tab('Library');
    await t.scrollTo(LIB_Y);
    await t.page.waitForTimeout(400);
    await t.page.touchscreen.tap(195, 460);
    await t.page.waitForTimeout(700);
    await t.swipe();
    expect(
      (await t.route()) === '/library',
      `swipe lands on Library (${await t.route()})`,
    );
    const y = await t.scrollTop();
    expect(
      Math.abs(y - LIB_Y) < 80,
      `list kept its place (${y}, was ${LIB_Y})`,
    );
  },
);

await run(
  'T03',
  'R1',
  'Trends, open a record, Back: Trends',
  'sample',
  async (t, expect) => {
    await t.tab('Trends');
    const rec = t.page.locator('main button.os-row').last();
    await t.tap(rec);
    expect(
      (await t.route()).startsWith('/library/'),
      `opened the exercise (${await t.route()})`,
    );
    await t.back();
    expect(
      (await t.route()) === '/history',
      `Back lands on Trends (${await t.route()})`,
    );
  },
);

await run(
  'T04',
  'R1',
  'Trends, open a record, edge swipe: Trends',
  'sample',
  async (t, expect) => {
    await t.tab('Trends');
    await t.tap(t.page.locator('main button.os-row').last());
    await t.swipe();
    expect(
      (await t.route()) === '/history',
      `swipe lands on Trends (${await t.route()})`,
    );
  },
);

await run(
  'T05',
  'R1',
  'Today, protein card, Back: Today',
  'empty',
  async (t, expect) => {
    await t.tap(t.page.getByRole('button', { name: /Protein/ }));
    expect(
      (await t.route()) === '/measurements',
      `opened Measurements (${await t.route()})`,
    );
    await t.back();
    expect(
      (await t.route()) === '/today',
      `Back lands on Today (${await t.route()})`,
    );
  },
);

await run(
  'T06',
  'R1',
  'Today, protein card, edge swipe: Today',
  'empty',
  async (t, expect) => {
    await t.tap(t.page.getByRole('button', { name: /Protein/ }));
    expect(
      (await t.route()) === '/measurements',
      `opened Measurements (${await t.route()})`,
    );
    await t.swipe();
    expect(
      (await t.route()) === '/today',
      `swipe lands on Today (${await t.route()})`,
    );
  },
);

await run(
  'T07',
  'R1 R2',
  'You, scrolled, Measurements, Back: You at the same place',
  'sample',
  async (t, expect) => {
    await t.tab('You');
    await t.scrollTo(400);
    await t.page.waitForTimeout(300);
    const y0 = await t.scrollTop();
    await t.tap(t.page.getByRole('button', { name: /Measurements/ }).first());
    expect(
      (await t.route()) === '/measurements',
      `opened Measurements (${await t.route()})`,
    );
    await t.back();
    expect(
      (await t.route()) === '/settings',
      `Back lands on You (${await t.route()})`,
    );
    const y = await t.scrollTop();
    expect(Math.abs(y - y0) < 40, `You kept its place (${y}, was ${y0})`);
  },
);

await run(
  'T08',
  'R1',
  'Today with no plan, Build manually, Back: Today',
  'empty',
  async (t, expect) => {
    await t.tap(t.page.getByRole('button', { name: 'Build manually' }));
    expect(
      (await t.route()) === '/routine/new',
      `opened the builder (${await t.route()})`,
    );
    await t.back();
    expect(
      (await t.route()) === '/today',
      `Back lands on Today (${await t.route()})`,
    );
  },
);

await run(
  'T09',
  'R1',
  'Today with no plan, Build my plan, Back: Today',
  'empty',
  async (t, expect) => {
    await t.tap(t.page.getByRole('button', { name: /Build my plan/ }));
    await t.back();
    expect(
      (await t.route()) === '/today',
      `Back lands on Today (${await t.route()})`,
    );
  },
);

await run(
  'T10',
  'R1',
  'Plan, Regenerate, Back: Plan',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    await t.tap(t.page.getByRole('button', { name: 'Regenerate' }));
    expect(
      (await t.route()) === '/onboarding',
      `opened the questions (${await t.route()})`,
    );
    await t.back();
    expect(
      (await t.route()) === '/plan',
      `Back lands on Plan (${await t.route()})`,
    );
  },
);

await run(
  'T11',
  'R1',
  'Exercise, Add to a day, Back: the exercise',
  'empty',
  async (t, expect) => {
    await t.tab('Library');
    await t.tap(
      t.page.locator('main button.os-row, main [role="button"].os-row').nth(3),
    );
    const ex = await t.route();
    await t.tap(t.page.getByRole('button', { name: 'Add to a day' }));
    expect(
      (await t.route()) === '/routine/new',
      `opened the builder (${await t.route()})`,
    );
    await t.back();
    expect(
      (await t.route()) === ex,
      `Back lands on the exercise (${await t.route()}, want ${ex})`,
    );
  },
);

await run(
  'T12',
  'R2',
  'Plan, open Pull, Edit, Back: Pull still open',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    await t.tap(t.page.getByRole('button', { name: /^Pull, / }));
    expect(
      /Pull/.test(await t.openDay()),
      `Pull opened (${await t.openDay()})`,
    );
    await t.tap(t.page.getByRole('button', { name: 'Edit Pull' }));
    await t.back();
    expect(
      (await t.route()) === '/plan',
      `Back lands on Plan (${await t.route()})`,
    );
    expect(
      /Pull/.test(await t.openDay()),
      `Pull still open (open: ${(await t.openDay()) || 'none'})`,
    );
  },
);

await run(
  'T13',
  'R2',
  'Plan, open Pull, edge swipe back from Edit: Pull still open',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    await t.tap(t.page.getByRole('button', { name: /^Pull, / }));
    await t.tap(t.page.getByRole('button', { name: 'Edit Pull' }));
    await t.swipe();
    expect(
      (await t.route()) === '/plan',
      `swipe lands on Plan (${await t.route()})`,
    );
    expect(
      /Pull/.test(await t.openDay()),
      `Pull still open (open: ${(await t.openDay()) || 'none'})`,
    );
  },
);

// R4 and R5: tasks return where they began; the workout sits over the screen that started it.
await run(
  'T14',
  'R4 R5',
  'Plan, start Pull, leave the workout: Plan, Pull still open',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    await t.tap(t.page.getByRole('button', { name: /^Pull, / }));
    await t.tap(t.page.getByRole('button', { name: 'Start this day instead' }));
    expect(
      await t.page.getByRole('button', { name: /Leave workout/ }).isVisible(),
      'the workout opened',
    );
    await t.tap(t.page.getByRole('button', { name: /Leave workout/ }));
    expect(
      (await t.route()) === '/plan',
      `leaving lands on Plan (${await t.route()})`,
    );
    expect(
      /Pull/.test(await t.openDay()),
      `Pull still open (open: ${(await t.openDay()) || 'none'})`,
    );
  },
);

await run(
  'T15',
  'R5',
  'Workout in progress: Today shows that day, not the next one',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    await t.tap(t.page.getByRole('button', { name: /^Pull, / }));
    await t.tap(t.page.getByRole('button', { name: 'Start this day instead' }));
    await t.tap(t.page.getByRole('button', { name: /Leave workout/ }));
    if ((await t.route()) !== '/today') await t.tab('Today');
    const h = await t.heroTitle();
    expect(/Pull/.test(h), `Today's card names the workout in progress (${h})`);
  },
);

await run(
  'T16',
  'R5',
  'Workout in progress: every tab offers a way back into it',
  'sample',
  async (t, expect) => {
    await t.tap(t.page.getByRole('button', { name: /Start workout/ }));
    await t.tap(t.page.getByRole('button', { name: /Leave workout/ }));
    for (const tab of ['Plan', 'Library', 'Trends', 'You']) {
      await t.tab(tab);
      const n = await t.page
        .getByRole('button', { name: /Resume|in progress/i })
        .count();
      expect(n > 0, `${tab} offers Resume`);
    }
  },
);

await run(
  'T24',
  'R5 R9',
  'Workout in progress: Plan offers Resume on its day and no second Start',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    await t.tap(t.page.getByRole('button', { name: /^Pull, / }));
    await t.tap(t.page.getByRole('button', { name: 'Start this day instead' }));
    await t.tap(t.page.getByRole('button', { name: /Leave workout/ }));
    const resume = t.page
      .locator('.os-acc--open')
      .getByRole('button', { name: 'Resume', exact: true });
    expect(await resume.isVisible(), 'Pull offers Resume');
    await t.tap(t.page.getByRole('button', { name: /^Push, / }));
    const starts = await t.page
      .locator('.os-acc--open')
      .getByRole('button', { name: /^Start/ })
      .count();
    expect(
      starts === 0,
      `Push offers no Start while Pull is in progress (${starts})`,
    );
  },
);

await run(
  'T17',
  'R4',
  'Plan, Regenerate, finish the questions: back on Plan',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    await t.tap(t.page.getByRole('button', { name: 'Regenerate' }));
    for (let i = 0; i < 5; i++) await t.tap(t.page.locator('.os-dock button'));
    await t.page.waitForTimeout(800);
    expect(
      (await t.route()) === '/plan',
      `finishing lands on Plan (${await t.route()})`,
    );
  },
);

await run(
  'T18',
  'R4',
  'Workout from Today, save: Today',
  'sample',
  async (t, expect) => {
    await t.tap(t.page.getByRole('button', { name: /Start workout/ }));
    await t.tap(t.page.getByRole('button', { name: /^Log set/ }));
    await t.tap(t.page.getByRole('button', { name: 'Finish', exact: true }));
    await t.tap(t.page.getByRole('button', { name: 'Save workout' }));
    await t.page.waitForTimeout(600);
    expect(
      (await t.route()) === '/today',
      `saving lands on Today (${await t.route()})`,
    );
  },
);

// R6: unsaved edits.
await run(
  'T19',
  'R6',
  'Builder with an edit, Back: asks before dropping it',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    await t.tap(t.page.getByRole('button', { name: /^Pull, / }));
    await t.tap(t.page.getByRole('button', { name: 'Edit Pull' }));
    await t.tap(t.page.getByRole('button', { name: 'Increase sets' }));
    await t.back();
    const asked = await t.page.getByRole('alertdialog').count();
    expect(
      asked > 0,
      `a Discard changes question appears (route ${await t.route()})`,
    );
  },
);

// R7 and R8: weights say what they are, and show before you start.
await run(
  'T20',
  'R7',
  'Builder: a dumbbell weight says per hand',
  'empty',
  async (t, expect) => {
    await t.tab('Library');
    const search = t.page
      .getByRole('searchbox')
      .or(t.page.getByRole('textbox'))
      .first();
    await t.tap(search);
    await search.fill('incline dumbbell press');
    await t.page.waitForTimeout(600);
    await t.tap(
      t.page.locator('main button.os-row, main [role="button"].os-row').first(),
    );
    await t.tap(t.page.getByRole('button', { name: 'Add to a day' }));
    const text = await t.page.locator('main').innerText();
    expect(/per hand/i.test(text), 'the weight tile says per hand');
  },
);

await run(
  'T21',
  'R8',
  'Plan: an open day shows each exercise with its weight',
  'sample',
  async (t, expect) => {
    await t.tab('Plan');
    const card = t.page.locator('.os-card--next');
    const text = await card.innerText();
    expect(
      /\d+\s*(lb|kg)/.test(text),
      `the open day lists weights (${text.replace(/\s+/g, ' ').slice(0, 80)})`,
    );
  },
);

// R3: tabs.
await run(
  'T22',
  'R3',
  'Tap the tab you are on: back to its top',
  'empty',
  async (t, expect) => {
    await t.tab('Library');
    await t.scrollTo(LIB_Y);
    await t.page.waitForTimeout(300);
    await t.tab('Library');
    await t.page.waitForTimeout(700);
    const y = await t.scrollTop();
    expect(y < 10, `Library is at its top (${y})`);
  },
);

await run(
  'T23',
  'R3',
  'Another tab and back: Library starts fresh (09-28 call)',
  'empty',
  async (t, expect) => {
    await t.tab('Library');
    await t.scrollTo(LIB_Y);
    await t.page.waitForTimeout(300);
    await t.tab('Plan');
    await t.tab('Library');
    const y = await t.scrollTop();
    expect(y < 10, `Library is at its top (${y})`);
  },
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length} of ${results.length} navigation cases pass`,
);
process.exit(failed.length === 0 ? 0 : 1);
