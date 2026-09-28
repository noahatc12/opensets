// Screenshot pass for the premium redesign: every route, sheet and overlay at 390x844 in
// dark and light, saved to design/redesign-shots/{mode}-{name}.png. Each shot also asserts
// that nothing overflows sideways (scrollWidth === clientWidth on the document and the app
// shell), which the eye misses and the phone does not.
//
//   npm run build && npm run preview     (in another terminal)
//   node scripts/redesign-shot.mjs        SHOT_ONLY=today,plan limits the steps
//
// Sample data comes from the app's own "Load sample data" control, never from constants here.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const OUT = process.env.SHOT_OUT ?? 'design/redesign-shots';
const ONLY = process.env.SHOT_ONLY
  ? new Set(process.env.SHOT_ONLY.split(','))
  : null;
const MODES = (process.env.SHOT_MODES ?? 'dark,light').split(',');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const report = { shots: [], errors: [], overflow: [] };

async function run(mode) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript(
    (t) => {
      try {
        localStorage.setItem('opensets-theme', t);
      } catch {
        /* ignore */
      }
    },
    JSON.stringify({ mode, theme: 'signal', ds: 'editorial' }),
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) =>
    report.errors.push(`${mode} PAGEERROR ${e.message}`),
  );
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|jsdelivr|net::ERR/i.test(m.text()))
      report.errors.push(`${mode} console ${m.text()}`);
  });

  const shot = async (name) => {
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => {
      const d = document.documentElement;
      const shell = document.querySelector('#root > div');
      return {
        doc: d.scrollWidth - d.clientWidth,
        shell: shell ? shell.scrollWidth - shell.clientWidth : 0,
      };
    });
    if (over.doc > 0 || over.shell > 0)
      report.overflow.push(
        `${mode}-${name}: doc ${over.doc}px shell ${over.shell}px`,
      );
    const path = `${OUT}/${mode}-${name}.png`;
    await page.screenshot({ path });
    report.shots.push(path);
  };
  const go = async (route) => {
    await page.evaluate((r) => {
      location.hash = '#/' + r;
    }, route);
    await page.waitForTimeout(500);
  };
  const click = async (name, opts = {}) => {
    const loc =
      opts.exact === false
        ? page.getByRole('button', { name })
        : page.getByRole('button', { name, exact: true });
    await (opts.last ? loc.last() : loc.first()).click({ timeout: 8000 });
    await page.waitForTimeout(opts.wait ?? 350);
  };
  // Buttons inside the open sheet or dialog, so a keypad "9" never resolves to the RPE "9" behind the scrim.
  const clickIn = async (name, wait = 300) => {
    await page
      .locator('[role="dialog"], [role="alertdialog"]')
      .last()
      .getByRole('button', { name, exact: true })
      .first()
      .click({ timeout: 8000 });
    await page.waitForTimeout(wait);
  };
  const clickText = async (text, wait = 350) => {
    await page
      .getByText(text, { exact: true })
      .first()
      .click({ timeout: 8000 });
    await page.waitForTimeout(wait);
  };
  const scrollMain = async (y) => {
    await page.evaluate((yy) => {
      const el = document.querySelector('main');
      const inner = el && el.querySelector('.overflow-auto, .overflow-y-auto');
      (inner ?? el)?.scrollTo(0, yy);
    }, y);
    await page.waitForTimeout(300);
  };
  const step = async (name, fn) => {
    if (ONLY && !ONLY.has(name)) return;
    try {
      await fn();
    } catch (e) {
      report.errors.push(
        `${mode} step ${name} FAILED ${e.message.split('\n')[0]}`,
      );
    }
  };

  await page.goto(BASE + '#/today', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Fresh install, then the app's own sample data (every later step needs it).
  if (!ONLY || ONLY.has('today')) await shot('today-empty');
  await click('Load sample data');
  await page
    .getByRole('button', { name: /Start workout/ })
    .waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);

  await step('today', async () => {
    await shot('today');
    await scrollMain(99999);
    await shot('today-bottom');
    await scrollMain(0);
  });

  await step('plan', async () => {
    await go('plan');
    await shot('plan');
    // Open a day that is not the next one, then the next one.
    const cards = page.getByRole('button', { name: /exercises/ });
    if ((await cards.count()) > 1) {
      await cards.nth(1).click();
      await page.waitForTimeout(400);
      await shot('plan-open');
    }
  });

  await step('builder', async () => {
    await go('routine/new');
    await page.getByRole('textbox').first().fill('Upper A');
    await click('Add exercise', { exact: false });
    await shot('sheet-picker');
    await page.getByRole('textbox', { name: /Search/ }).fill('bench');
    await page.waitForTimeout(500);
    await click('Add Barbell Bench Press - Medium Grip', {
      exact: false,
    }).catch(async () => {
      await page.getByRole('button', { name: /^Add / }).first().click();
    });
    await page.waitForTimeout(400);
    await click('Add exercise', { exact: false });
    await page.getByRole('textbox', { name: /Search/ }).fill('row');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Add / }).first().click();
    await page.waitForTimeout(400);
    await shot('builder');
  });

  await step('library', async () => {
    await go('library');
    await page.waitForTimeout(800);
    await shot('library');
    await click('Filters', { exact: false });
    await shot('sheet-filters');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /e1RM/ }).first().click();
    await page.waitForTimeout(800);
    await shot('detail');
    await scrollMain(99999);
    await shot('detail-bottom');
  });

  await step('trends', async () => {
    await go('history');
    await page.waitForTimeout(600);
    await shot('trends');
    await scrollMain(99999);
    await shot('trends-bottom');
  });

  await step('you', async () => {
    await go('settings');
    await page.waitForTimeout(500);
    await shot('you');
    await scrollMain(99999);
    await shot('you-bottom');
    await click('Erase all data', { exact: false });
    await shot('sheet-confirm-erase');
    await clickIn('Cancel');
    await go('plates');
    await shot('plates');
    await scrollMain(99999);
    await shot('plates-bottom');
    await go('rest-defaults');
    await shot('rest-defaults');
    await go('profile');
    await shot('profile');
    await go('goals');
    await shot('goals');
    await go('measurements');
    await shot('measurements');
  });

  await step('onboarding', async () => {
    await go('onboarding');
    await page.waitForTimeout(400);
    for (let i = 1; i <= 5; i++) {
      await shot(`onboarding-${i}`);
      if (i < 5) await click('Continue');
      await page.waitForTimeout(400);
    }
    await go('today');
  });

  await step('session', async () => {
    await go('today');
    await page.waitForTimeout(500);
    await click('Start workout', { exact: false, wait: 900 });
    await shot('log');
    await click('Type weight');
    await shot('sheet-keypad');
    await clickIn('Cancel');
    const perSide = page.getByRole('button', { name: /Per side/ });
    if (await perSide.count()) {
      await perSide.first().click();
      await page.waitForTimeout(400);
      await shot('sheet-plates');
      await clickIn('Done');
    }
    await click('8');
    await click('Log set', { exact: false, wait: 700 });
    const keepGoing = page.getByRole('button', { name: 'Keep going' });
    if (await keepGoing.count()) {
      await shot('record-first');
      await keepGoing.click();
      await page.waitForTimeout(400);
    }
    await shot('rest');
    await click('Skip rest');
    // A record: type a big weight and log it.
    await click('Type weight');
    for (const k of ['9', '9', '9']) await clickIn(k, 120);
    await clickIn('Set', 400);
    await click('Log set', { exact: false, wait: 900 });
    await shot('record');
    await click('Keep going');
    await click('Skip rest').catch(() => {});
    await shot('log-toast');
    await click('Finish', { wait: 700 });
    await shot('summary');
    await click('Discard');
    await shot('sheet-confirm-discard');
    await clickIn('Cancel');
    await click('Save workout', { wait: 900 });
    await shot('today-after');
  });

  await ctx.close();
}

for (const mode of MODES) {
  try {
    await run(mode);
  } catch (e) {
    report.errors.push(`${mode} FAILED ${e.message}`);
  }
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(
  `${report.shots.length} shots, ${report.errors.length} errors, ${report.overflow.length} overflow`,
);
for (const e of report.errors) console.log('  ERR ' + e);
for (const o of report.overflow) console.log('  OVERFLOW ' + o);
process.exitCode = report.overflow.length ? 1 : 0;
