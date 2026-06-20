import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:4173/opensets/';
mkdirSync('.shots/audit', { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const setTheme = (t) => p.evaluate((v) => localStorage.setItem('opensets-theme', v), JSON.stringify(t));
const setUnits = (u) => p.evaluate((unit) => new Promise((res, rej) => {
  const o = indexedDB.open('opensets');
  o.onsuccess = () => { const tx = o.result.transaction('settings','readwrite'); const s = tx.objectStore('settings');
    const g = s.get('user'); g.onsuccess = () => { const r = g.result || { key:'user' }; r.units = unit; s.put(r); };
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); };
  o.onerror = () => rej(o.error);
}), u);
const shot = (n) => p.screenshot({ path: `.shots/audit/${n}.png`, fullPage: true });

// seed once
await p.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await p.reload({ waitUntil: 'networkidle' });
const seed = p.getByText('Load sample data', { exact:false });
if (await seed.count()) { await seed.first().click(); await p.waitForTimeout(1500); }
// grab a library exercise id for detail
await p.goto(`${BASE}#/library`, { waitUntil:'networkidle' }); await p.waitForTimeout(500);

const routes = ['today','plan','library','history','settings','appearance','plates','rest-defaults','goals','measurements'];
for (const [tname, theme, units] of [
  ['tempo-kg', { mode:'dark', theme:'tempo', ds:'tempo' }, 'kg'],
  ['readout',  { mode:'dark', theme:'teal',  ds:'readout' }, 'kg'],
  ['tempo-lb', { mode:'dark', theme:'tempo', ds:'tempo' }, 'lb'],
]) {
  await setTheme(theme); await setUnits(units);
  const list = tname === 'tempo-lb' ? ['today','history','settings'] : routes;
  for (const r of list) {
    await p.goto(`${BASE}#/${r}`, { waitUntil:'networkidle' });
    if (r === routes[0]) await p.reload({ waitUntil:'networkidle' });
    await p.waitForTimeout(550);
    await shot(`${tname}-${r}`);
  }
  // exercise detail (click first library row)
  if (tname !== 'tempo-lb') {
    await p.goto(`${BASE}#/library`, { waitUntil:'networkidle' }); await p.waitForTimeout(500);
    const row = p.locator('button').filter({ hasText: /press|squat|curl|row|deadlift/i }).first();
    if (await row.count()) { await row.click(); await p.waitForTimeout(600); await shot(`${tname}-detail`); }
  }
  // active session
  await p.goto(`${BASE}#/today`, { waitUntil:'networkidle' }); await p.waitForTimeout(400);
  const start = p.getByText('Start workout', { exact:false });
  if (await start.count()) { await start.first().click(); await p.waitForTimeout(800); await shot(`${tname}-session`);
    // finish so next config starts clean-ish
    const fin = p.getByText('Finish', { exact:true }); if (await fin.count()) { await fin.first().click(); await p.waitForTimeout(500);} }
}
// onboarding steps (tempo)
await setTheme({ mode:'dark', theme:'tempo', ds:'tempo' });
await p.goto(`${BASE}#/onboarding`, { waitUntil:'networkidle' }); await p.waitForTimeout(400);
for (let i=0;i<6;i++){ await shot(`onboarding-step${i}`); const c=p.getByText(/Get started|Continue|Build my plan/).first(); if(await c.count()){ await c.click(); await p.waitForTimeout(350);} }
// builder populated
await p.goto(`${BASE}#/routine/new`, { waitUntil:'networkidle' }); await p.waitForTimeout(400);
const add = p.getByText('Add exercise', { exact:false });
if (await add.count()) { await add.first().click(); await p.waitForTimeout(600);
  const ex = p.locator('button').filter({ hasText: /press|squat|curl/i }).first();
  if (await ex.count()) { await ex.click(); await p.waitForTimeout(400);} }
await shot('builder-populated');
console.log('captured');
await b.close();
