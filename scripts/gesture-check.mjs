// Gesture check for the premium feel: drives real touch input through CDP against the
// running preview and asserts what each gesture must do. Also saves a mid-drag frame of
// each so the dim, the shadow and the scrim can be looked at.
//
//   npm run build && npm run preview     (in another terminal)
//   node scripts/gesture-check.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const OUT = process.env.SHOT_OUT ?? 'design/redesign-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
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
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

/** A finger drag from (x0,y0) to (x1,y1) over `ms`, in `steps` moves, with an optional
 *  callback mid-way (for a screenshot). */
async function drag(x0, y0, x1, y1, { ms = 260, steps = 14, midway } = {}) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: x0, y: y0 }],
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t; // linear finger
    const x = x0 + (x1 - x0) * ease;
    const y = y0 + (y1 - y0) * ease;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    });
    await page.waitForTimeout(ms / steps);
    if (midway && i === Math.floor(steps / 2)) await midway();
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}
const hash = () => page.evaluate(() => location.hash);

await page.goto(BASE + '#/today', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const seed = page.getByRole('button', { name: 'Load sample data' });
if (await seed.count()) {
  await seed.click();
  await page
    .getByRole('button', { name: /Start workout/ })
    .waitFor({ timeout: 15000 });
}

// 1. Tab switch through the view transition.
await page.getByRole('link', { name: 'Plan' }).click();
await page.waitForTimeout(500);
check('tab switch lands on Plan', (await hash()) === '#/plan', await hash());

// 2. Push into a pushed screen, then edge-swipe back.
await page.getByRole('link', { name: 'Library' }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /e1RM/ }).first().click();
await page.waitForTimeout(700);
check(
  'push lands on detail',
  (await hash()).startsWith('#/library/'),
  await hash(),
);
await drag(6, 420, 330, 430, {
  midway: async () => {
    await page.screenshot({ path: `${OUT}/gesture-swipe-back-mid.png` });
    const tf = await page.evaluate(
      () => document.querySelector('.os-pushed')?.style.transform ?? '',
    );
    check('screen follows the finger', /translate3d\(\d+/.test(tf), tf);
    const under = await page.evaluate(() => {
      const u = document.querySelector('.os-pushed-parent');
      return u
        ? { text: u.textContent?.slice(0, 40), tf: u.style.transform }
        : null;
    });
    check(
      'parent screen is under the finger',
      !!under && /Library/.test(under.text ?? ''),
      JSON.stringify(under),
    );
  },
});
await page.waitForTimeout(900);
check(
  'edge swipe pops back to Library',
  (await hash()) === '#/library',
  await hash(),
);

// 3. A swipe that starts away from the edge is a scroll, not a pop.
await page.getByRole('button', { name: /e1RM/ }).first().click();
await page.waitForTimeout(600);
await drag(120, 420, 330, 425);
await page.waitForTimeout(500);
check(
  'mid-screen horizontal drag does not pop',
  (await hash()).startsWith('#/library/'),
  await hash(),
);
// 4. A short edge drag springs back.
await drag(6, 420, 60, 422);
await page.waitForTimeout(700);
check(
  'short edge drag springs home',
  (await hash()).startsWith('#/library/'),
  await hash(),
);
const tfAfter = await page.evaluate(
  () => document.querySelector('.os-pushed')?.style.transform ?? '',
);
check(
  'screen rests at zero after the spring',
  tfAfter === '' || /translate3d\(0px/.test(tfAfter),
  tfAfter,
);

// 5. Sheets: drag down to dismiss, and a small drag springs back.
await page.getByRole('button', { name: 'Back' }).click();
await page.waitForTimeout(600);
await page.getByRole('link', { name: 'Today' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Start workout/ }).click();
await page.waitForTimeout(900);
await page
  .getByRole('button', { name: /Per side/ })
  .first()
  .click();
await page.waitForTimeout(600);
const sheetBox = await page.locator('.os-sheet').boundingBox();
check('plate sheet opens', !!sheetBox);
await drag(195, sheetBox.y + 20, 195, sheetBox.y + 60);
await page.waitForTimeout(700);
check(
  'small sheet drag springs back',
  (await page.locator('.os-sheet').count()) === 1,
);
await drag(195, sheetBox.y + 20, 195, sheetBox.y + 420, {
  midway: async () => {
    await page.screenshot({ path: `${OUT}/gesture-sheet-drag-mid.png` });
    const op = await page.evaluate(
      () => document.querySelector('.os-scrim')?.style.opacity ?? '',
    );
    check('scrim fades with the drag', op !== '' && parseFloat(op) < 1, op);
  },
});
await page.waitForTimeout(800);
check(
  'long sheet drag dismisses',
  (await page.locator('.os-sheet').count()) === 0,
);
// 6. A flick dismisses even when short.
await page
  .getByRole('button', { name: /Per side/ })
  .first()
  .click();
await page.waitForTimeout(600);
const b2 = await page.locator('.os-sheet').boundingBox();
await drag(195, b2.y + 20, 195, b2.y + 140, { ms: 60, steps: 4 });
await page.waitForTimeout(800);
check(
  'flick dismisses the sheet',
  (await page.locator('.os-sheet').count()) === 0,
);
// 7. Keypad: dragging on the keys (not scrolled) also dismisses; scrim tap animates out.
await page.getByRole('button', { name: 'Type weight' }).click();
await page.waitForTimeout(600);
await page.locator('.os-scrim').click({ position: { x: 100, y: 100 } });
await page.waitForTimeout(700);
check(
  'scrim tap closes the keypad',
  (await page.locator('.os-sheet').count()) === 0,
);

// 8. Onboarding: edge swipe on step 1 pops out.
await page.evaluate(() => {
  location.hash = '#/onboarding';
});
await page.waitForTimeout(700);
await drag(6, 500, 330, 505);
await page.waitForTimeout(900);
check(
  'edge swipe leaves onboarding',
  !(await hash()).startsWith('#/onboarding'),
  await hash(),
);

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  `${results.length - failed} of ${results.length} gesture checks pass`,
);
process.exitCode = failed ? 1 : 0;
