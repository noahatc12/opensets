// Scroll memory check: a screen keeps its place when you open something and come back,
// by the back button and by an edge swipe, and the copy under the finger during the swipe
// shows the same place. The Library also keeps its search text. Noah hit this on 09-28:
// deep in the Library, open an exercise, swipe back, and the list was at the top.
//
//   npm run build && npm run preview     (in another terminal)
//   node scripts/scroll-check.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('opensets-onboarded', '1');
  } catch {
    /* ignore */
  }
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function drag(x0, y0, x1, y1, { ms = 500, steps = 16, midway } = {}) {
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
    if (midway && i === Math.floor(steps * 0.75)) await midway();
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

const hash = () => page.evaluate(() => location.hash);
/** The Library scroller (the real one, not the copy under a swipe) and the first row
 *  whose top is below the search area. */
const libState = (sel = 'main .os-shell, main') =>
  page.evaluate((s) => {
    const roots = [...document.querySelectorAll(s)];
    const scroller = roots
      .flatMap((r) => [...r.querySelectorAll('div.overflow-auto')])
      .find((d) => !d.closest('.os-pushed-parent'));
    if (!scroller) return null;
    const rows = [...scroller.querySelectorAll('button.os-row')];
    const first = rows.find((b) => b.getBoundingClientRect().top > 120);
    return {
      top: Math.round(scroller.scrollTop),
      first: first?.querySelector('span span')?.textContent ?? '',
    };
  }, sel);

await page.goto(BASE + '#/library', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. Deep in the Library, open an exercise, press Back.
await page.evaluate(() => {
  const s = [...document.querySelectorAll('main div.overflow-auto')][0];
  s.scrollTop = 6000;
});
await page.waitForTimeout(500);
const before = await libState();
check(
  'library scrolled deep',
  before && before.top > 5000,
  JSON.stringify(before),
);
await page.getByRole('button', { name: before.first }).first().click();
await page.waitForTimeout(700);
check(
  'opened the exercise',
  (await hash()).startsWith('#/library/'),
  await hash(),
);
await page.getByRole('button', { name: /back/i }).first().click();
await page.waitForTimeout(900);
const afterBack = await libState();
check(
  'Back button: same place in the Library',
  afterBack &&
    Math.abs(afterBack.top - before.top) <= 2 &&
    afterBack.first === before.first,
  `${JSON.stringify(before)} -> ${JSON.stringify(afterBack)}`,
);

// 2. Same, by edge swipe; the copy under the finger shows the same place.
await page.getByRole('button', { name: before.first }).first().click();
await page.waitForTimeout(700);
let under = null;
await drag(6, 460, 300, 462, {
  midway: async () => {
    under = await page.evaluate(() => {
      const s = document.querySelector('.os-pushed-parent div.overflow-auto');
      return s ? Math.round(s.scrollTop) : null;
    });
  },
});
check(
  'mid-swipe: the Library under the finger is at the same place',
  under !== null && Math.abs(under - before.top) <= 2,
  `${under} vs ${before.top}`,
);
await page.waitForTimeout(900);
const afterSwipe = await libState();
check(
  'edge swipe: same place in the Library',
  (await hash()) === '#/library' &&
    afterSwipe &&
    Math.abs(afterSwipe.top - before.top) <= 2 &&
    afterSwipe.first === before.first,
  `${await hash()} ${JSON.stringify(afterSwipe)}`,
);

// 3. Search text and results survive a round trip.
await page.evaluate(() => {
  const s = [...document.querySelectorAll('main div.overflow-auto')][0];
  s.scrollTop = 0;
});
await page.getByRole('textbox', { name: /search exercises/i }).fill('curl');
await page.waitForTimeout(500);
const firstHit = await page.evaluate(
  () =>
    document.querySelector('main button.os-row span span')?.textContent ?? '',
);
await page.getByRole('button', { name: firstHit }).first().click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /back/i }).first().click();
await page.waitForTimeout(900);
const q = await page
  .getByRole('textbox', { name: /search exercises/i })
  .inputValue();
check('search text kept after coming back', q === 'curl', q);
await page.getByRole('textbox', { name: /search exercises/i }).fill('');

// 4. Settings keeps its place when a row opens a pushed screen. The row is put on screen
//    first (at y 560), so the tap itself does not scroll the list.
await page.getByRole('link', { name: 'You' }).click();
await page.waitForTimeout(700);
const sBefore = await page.evaluate(() => {
  const s = [...document.querySelectorAll('main div.overflow-auto')][0];
  const row = [...s.querySelectorAll('button.os-row')].find((b) =>
    /goals/i.test(b.textContent ?? ''),
  );
  const y =
    row.getBoundingClientRect().top -
    s.getBoundingClientRect().top +
    s.scrollTop;
  s.scrollTop = Math.max(0, y - 560);
  return Math.round(s.scrollTop);
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  const s = [...document.querySelectorAll('main div.overflow-auto')][0];
  [...s.querySelectorAll('button.os-row')]
    .find((b) => /goals/i.test(b.textContent ?? ''))
    .click();
});
await page.waitForTimeout(700);
const pushed = await hash();
await drag(6, 460, 300, 462);
await page.waitForTimeout(900);
const sAfter = await page.evaluate(
  () => [...document.querySelectorAll('main div.overflow-auto')][0].scrollTop,
);
check(
  'Settings: same place after a swipe back from an inner screen',
  pushed !== '#/settings' &&
    (await hash()) === '#/settings' &&
    sBefore > 100 &&
    Math.abs(sAfter - sBefore) <= 2,
  `${pushed}: ${sBefore} -> ${Math.round(sAfter)} ${await hash()}`,
);

// 5. A relaunch starts at the top (positions are per launch).
await page.goto(BASE + '#/library', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const fresh = await libState();
check(
  'a fresh launch starts at the top',
  fresh && fresh.top === 0,
  JSON.stringify(fresh),
);

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
