// Reference capture for the OpenSets redesign prototype (Claude Design, 2026-09-25).
// Serves the .dc.html through a local http server (started by the caller), drives the
// prototype's own UI, and screenshots the phone frame for every screen and overlay,
// in dark and light, so the port can be checked against the reference and not memory.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.REF_BASE ?? 'http://localhost:8766/index.html';
const OUT = process.env.REF_OUT ?? 'ref';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const report = { shots: [], errors: [] };

async function run(mode) {
  const ctx = await browser.newContext({ viewport: { width: 520, height: 960 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${mode} PAGEERROR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${mode} console ${m.text()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen-label]', { timeout: 30000 });
  await page.waitForTimeout(800); // fonts
  const phone = page.locator('div[data-mode]').first();
  const shot = async (name) => {
    await page.waitForTimeout(350);
    const path = `${OUT}/${mode}-${name}.png`;
    await phone.screenshot({ path });
    report.shots.push(path);
  };
  // DOM click helper: the prototype's buttons nest their labels in spans, so match on
  // trimmed textContent inside the phone frame and dispatch a real click.
  const clickText = async (re, opts = {}) => {
    const ok = await page.evaluate(({ src, flags, last, aria }) => {
      const r = new RegExp(src, flags);
      const root = document.querySelector('div[data-mode]');
      let els = [...root.querySelectorAll(aria ? `button[aria-label="${aria}"]` : 'button, label')];
      if (!aria) els = els.filter((b) => r.test(b.textContent.replace(/\s+/g, ' ').trim()));
      const el = last ? els[els.length - 1] : els[0];
      if (!el) return false;
      el.click();
      return true;
    }, { src: re.source, flags: re.flags, last: !!opts.last, aria: opts.aria || null });
    if (!ok) throw new Error(`no button matching ${re}`);
    await page.waitForTimeout(220);
  };
  const tab = (t) => clickText(new RegExp(`^${t}$`, 'i'));
  const back = () => clickText(/./, { aria: 'Back' });

  // Mode via the You tab (the prototype persists settings in localStorage).
  await tab('You');
  await page.waitForTimeout(200);
  await clickText(mode === 'light' ? /^Light$/ : /^Dark$/);
  await page.waitForTimeout(200);
  await shot('you');
  // Accents (Today only, to show the four looks).
  await tab('Today');
  await shot('today');
  for (const acc of ['Volt', 'Teal', 'Brass', 'Signal']) {
    await tab('You');
    await clickText(new RegExp(`^${acc}$`));
    await tab('Today');
    if (acc !== 'Signal') await shot(`today-accent-${acc.toLowerCase()}`);
  }
  // Scroll Today to the bottom half.
  await phone.locator('[data-screen-label="Today"]').evaluate((el) => el.scrollTo(0, 99999));
  await shot('today-bottom');

  await tab('Plan');
  await shot('plan');
  await clickText(/^Edit$/);
  await shot('builder');
  await clickText(/Add exercise/);
  await shot('sheet-picker');
  await clickText(/^Cancel$/);
  await back();
  await clickText(/Regenerate plan/);
  await shot('onboarding-1');
  for (let i = 0; i < 5; i++) await clickText(/^Continue$/);
  await shot('onboarding-preview');
  await back();
  for (let i = 0; i < 5; i++) await back();

  await tab('Library');
  await shot('library');
  await clickText(/^Bench Press/);
  await shot('detail');
  await clickText(/Add to routine/);
  await shot('sheet-to-routine');
  await page.evaluate(() => { const sc = [...document.querySelectorAll('div[data-mode] div')].find((d) => d.style.background && d.style.background.includes('scrim')); sc && sc.click(); });
  await page.waitForTimeout(300);
  await back().catch(() => {});

  await tab('Trends');
  await shot('trends');
  await phone.locator('[data-screen-label="Trends"]').evaluate((el) => el.scrollTo(0, 99999));
  await shot('trends-bottom');

  // Active session
  await tab('Today');
  await clickText(/Start workout/);
  await shot('session');
  await clickText(/./, { aria: 'Type weight' });
  await shot('sheet-keypad');
  await clickText(/^Cancel$/);
  if (await page.evaluate(() => [...document.querySelectorAll('div[data-mode] button')].some((b) => /PER SIDE/.test(b.textContent)))) {
    await clickText(/PER SIDE/);
    await shot('sheet-plates');
    await clickText(/^Done$/);
  }
  await clickText(/^8$/); // RPE 8
  await clickText(/^Log set/);
  await shot('session-logged-rest');
  await page.waitForTimeout(3600);
  // A huge PR: type 999 in the keypad and log.
  await clickText(/./, { aria: 'Type weight' });
  for (const k of ['9', '9', '9']) await clickText(new RegExp(`^${k}$`), { last: true });
  await clickText(/^Set$/);
  await clickText(/^Log set/);
  await page.waitForTimeout(250);
  await shot('pr-celebration');
  await clickText(/TAP TO CONTINUE/).catch(() => {});
  await page.waitForTimeout(200);
  await shot('session-toast-undo');
  await clickText(/./, { aria: 'Minimize workout' });
  await shot('today-mini-bar');
  await clickText(/Resume/);
  await clickText(/^Finish$/);
  await shot('summary');
  await clickText(/^Discard$/);
  await shot('sheet-confirm');
  await clickText(/^Discard$/, { last: true });

  // Fresh user states
  await page.evaluate(() => window.__dcSetProps && window.__dcSetProps(window.__dcRootName(), { freshUser: true }));
  await page.waitForTimeout(500);
  await tab('Today');
  await shot('fresh-today');
  await tab('Plan');
  await shot('fresh-plan');
  await tab('Trends');
  await shot('fresh-trends');
  await tab('Library');
  await shot('fresh-library');
  await page.evaluate(() => window.__dcSetProps && window.__dcSetProps(window.__dcRootName(), { freshUser: false, numerals: 'standard' }));
  await page.waitForTimeout(500);
  await tab('Today');
  await shot('today-numerals-standard');
  await ctx.close();
}

for (const mode of ['dark', 'light']) {
  try { await run(mode); } catch (e) { report.errors.push(`${mode} FAILED ${e.message}`); }
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(`${report.shots.length} shots, ${report.errors.length} errors`);
for (const e of report.errors) console.log('  ' + e);
