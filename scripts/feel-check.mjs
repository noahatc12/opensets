// Feel tuning check: proves the panel's choice changes what a gesture does, not just what
// the panel shows. The same 140 px edge drag must spring home on Firm (commits past 43%)
// and go back on Now (commits past 33%). Also covers both ways in (`?tune`, five taps on
// the Settings version line), the practice sheet, and saves the panel in both modes.
//
//   npm run build && npm run preview     (in another terminal)
//   node scripts/feel-check.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const OUT = process.env.SHOT_OUT ?? 'design/redesign-shots';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();

async function open(mode, url) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await ctx.addInitScript((m) => {
    try {
      localStorage.setItem(
        'opensets-theme',
        JSON.stringify({ mode: m, theme: 'signal', ds: 'editorial' }),
      );
      localStorage.setItem('opensets-onboarded', '1');
    } catch {
      /* ignore */
    }
  }, mode);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return { ctx, page, cdp, errors };
}

async function drag(page, cdp, x0, y0, x1, y1, ms = 700, steps = 20) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: x0, y: y0 }],
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t }],
    });
    await page.waitForTimeout(ms / steps);
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

const panel = (page) => page.getByRole('region', { name: 'Feel tuning' });
const hash = (page) => page.evaluate(() => location.hash);

// 1. `?tune` opens the panel; shots in both modes.
for (const mode of ['dark', 'light']) {
  const { ctx, page } = await open(mode, '?tune#/settings');
  const shown = await panel(page).isVisible();
  if (mode === 'dark') check('?tune shows the panel', shown);
  const over = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  if (mode === 'dark')
    check('no sideways overflow with the panel open', over === 0, String(over));
  await page.screenshot({ path: `${OUT}/feel-panel-${mode}.png` });
  await ctx.close();
}

// 2. The same drag, two triggers, two outcomes.
{
  const { ctx, page, cdp, errors } = await open('dark', '?tune#/settings');
  await page
    .getByRole('radiogroup', { name: 'Swipe back trigger' })
    .getByRole('radio', { name: 'Firm' })
    .click();
  await page.getByRole('button', { name: 'Try it' }).first().click();
  await page.waitForTimeout(600);
  check(
    'Try it lands on an inner screen',
    (await hash(page)) === '#/plates',
    await hash(page),
  );
  check(
    'the panel steps aside for the gesture',
    !(await panel(page).isVisible()),
  );
  await drag(page, cdp, 6, 460, 146, 462);
  await page.waitForTimeout(900);
  check(
    'Firm: a 140 px drag springs home',
    (await hash(page)) === '#/plates',
    await hash(page),
  );
  await page.screenshot({ path: `${OUT}/feel-pill-dark.png` });

  await page.getByRole('button', { name: 'Feel' }).click();
  await page
    .getByRole('radiogroup', { name: 'Swipe back trigger' })
    .getByRole('radio', { name: 'Now' })
    .click();
  await page.getByRole('button', { name: 'Hide' }).click();
  await drag(page, cdp, 6, 460, 146, 462);
  await page.waitForTimeout(900);
  check(
    'Now: the same drag goes back',
    (await hash(page)) === '#/settings',
    await hash(page),
  );

  // 3. Practice sheet: opens, a small drag springs back, a long one closes and the
  //    panel returns.
  await page.getByRole('button', { name: 'Feel' }).click();
  await page.getByRole('button', { name: 'Try it' }).nth(1).click();
  const sheet = page.getByRole('dialog', { name: 'Practice sheet' });
  await page.waitForTimeout(600);
  check('practice sheet opens', await sheet.isVisible());
  const box = await sheet.boundingBox();
  await drag(page, cdp, 195, box.y + 12, 195, box.y + 50, 300, 8);
  await page.waitForTimeout(700);
  check('practice sheet: small drag springs back', await sheet.isVisible());
  await drag(page, cdp, 195, box.y + 12, 195, box.y + 400, 500, 14);
  await page.waitForTimeout(900);
  check('practice sheet: long drag closes', !(await sheet.isVisible()));
  check('the panel comes back after the sheet', await panel(page).isVisible());
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. Five taps on the version line turn it on in an app with no address bar; Turn off
//    clears it.
{
  const { ctx, page, errors } = await open('dark', '#/settings');
  check('no panel without tune mode', !(await panel(page).isVisible()));
  const ver = page.getByText(/v1\.0/);
  await ver.scrollIntoViewIfNeeded();
  for (let i = 0; i < 5; i++) await ver.click();
  await page.waitForTimeout(300);
  check(
    'five taps on the version line open the panel',
    await panel(page).isVisible(),
  );
  await page.getByRole('button', { name: 'Turn off' }).click();
  const stored = await page.evaluate(() =>
    localStorage.getItem('opensets-tune'),
  );
  check(
    'Turn off hides it and clears the flag',
    !(await panel(page).isVisible()) && stored === null,
    String(stored),
  );
  check('no page errors (taps)', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
