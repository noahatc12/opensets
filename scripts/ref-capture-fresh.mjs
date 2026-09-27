// Fresh-user reference capture: the prototype's runtime crashes on prop overrides, so the
// empty states are reached through its own "Erase all data" flow instead.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.REF_BASE ?? 'http://localhost:8766/index.html';
const OUT = process.env.REF_OUT ?? 'ref';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const report = { shots: [], errors: [] };

for (const mode of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 520, height: 960 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${mode} PAGEERROR ${e.message}`));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen-label]', { timeout: 30000 });
  await page.waitForTimeout(800);
  const phone = page.locator('div[data-mode]').first();
  const shot = async (name) => { await page.waitForTimeout(350); const p = `${OUT}/${mode}-${name}.png`; await phone.screenshot({ path: p }); report.shots.push(p); };
  const clickText = async (re, last = false) => {
    const ok = await page.evaluate(({ src, flags, last }) => {
      const r = new RegExp(src, flags);
      const els = [...document.querySelector('div[data-mode]').querySelectorAll('button')].filter((b) => r.test(b.textContent.replace(/\s+/g, ' ').trim()));
      const el = last ? els[els.length - 1] : els[0];
      if (!el) return false; el.click(); return true;
    }, { src: re.source, flags: re.flags, last });
    if (!ok) throw new Error(`no button matching ${re}`);
    await page.waitForTimeout(220);
  };
  try {
    await clickText(/^You$/i);
    await clickText(mode === 'light' ? /^Light$/ : /^Dark$/);
    await clickText(/Erase all data/);
    await shot('sheet-confirm-erase');
    await clickText(/^Erase all data$/, true);
    await shot('fresh-today');
    await clickText(/^Plan$/i);
    await shot('fresh-plan');
    await clickText(/^Trends$/i);
    await shot('fresh-trends');
    await clickText(/^Library$/i);
    await shot('fresh-library');
    await clickText(/^You$/i);
    await shot('fresh-you');
    await clickText(/^Today$/i);
    await clickText(/Build my plan/);
    await shot('fresh-onboarding-1');
    await clickText(/^Continue$/);
    await shot('fresh-onboarding-2');
    for (let i = 0; i < 4; i++) await clickText(/^Continue$/);
    await shot('fresh-onboarding-preview');
    await clickText(/Use this plan/);
    await shot('fresh-after-plan-today');
    await clickText(/Start workout/);
    await shot('fresh-session-first-time');
  } catch (e) { report.errors.push(`${mode} FAILED ${e.message}`); }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/report-fresh.json`, JSON.stringify(report, null, 2));
console.log(`${report.shots.length} shots, ${report.errors.filter((e) => e.includes('FAILED')).length} failures`);
for (const e of report.errors.filter((e) => e.includes('FAILED'))) console.log('  ' + e);
