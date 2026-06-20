import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:4173/opensets/';
mkdirSync('.shots', { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await p.reload({ waitUntil: 'networkidle' });
const seed = p.getByText('Load sample data', { exact: false });
if (await seed.count()) { await seed.first().click(); await p.waitForTimeout(1500); }
await p.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('opensets');
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const g = store.get('user');
    g.onsuccess = () => { const row = g.result || { key: 'user' }; row.units = 'lb'; store.put(row); };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  };
  open.onerror = () => reject(open.error);
}));
// reload so useSettings re-reads the changed units
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: '.shots/lb-today.png', fullPage: true });
const start = p.getByText('Start workout', { exact: false });
if (await start.count()) { await start.first().click(); await p.waitForTimeout(900);
  await p.screenshot({ path: '.shots/lb-session.png', fullPage: true }); }
console.log('done');
await b.close();
