import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://localhost:4173/opensets/#/settings', { waitUntil:'networkidle' });
await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(600);
await p.screenshot({ path:'.shots/v3-settings.png', fullPage:true });
const r = p.getByText('Reset all data', { exact:false });
if (await r.count()) { await r.first().click(); await p.waitForTimeout(300);
  await p.screenshot({ path:'.shots/v3-settings-confirm.png', fullPage:true }); }
console.log('done'); await b.close();
