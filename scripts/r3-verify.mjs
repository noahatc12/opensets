// R3 live verification: drive onboarding with a priority muscle, finish, then read the
// persisted workout templates from IndexedDB to prove the R3 volume allocator reached
// storage — per-slot set counts now VARY by muscle (pre-R3 every slot was flat sets:3),
// within-muscle doubling appears, and the plan renders without errors.
// Usage: vite preview on :4173, then `node scripts/r3-verify.mjs`.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
mkdirSync('.shots', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const cta = (name) => page.getByRole('button', { name, exact: true }).last();
const pick = (name) => page.getByRole('button', { name, exact: true }).first().click();
const pickContains = (name) => page.getByRole('button', { name, exact: false }).first().click();

await page.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await page.evaluate(() => new Promise((res) => { const r = indexedDB.deleteDatabase('opensets-lb'); r.onsuccess = r.onerror = r.onblocked = () => res(); }));

await page.goto(`${BASE}#/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await cta('Get started').click();
await pick('Build muscle');                         // goal: hypertrophy
await cta('Continue').click();
await pick('5');                                    // days
await pick('Full gym');                             // equipment
await pickContains('Auto');                         // split choice = auto (composer picks)
await cta('Continue').click();
await pickContains('Intermediate');                 // experience
await cta('Continue').click();
await pick('Chest');                                // priority muscle → volume bias + doubling
await page.waitForTimeout(200);
await cta('Continue').click();                      // → preview
await page.waitForTimeout(300);
await page.screenshot({ path: '.shots/r3-onb-plan-preview.png', fullPage: true });
await cta('Build my plan').click();
await page.waitForTimeout(900);

const data = await page.evaluate(async () => {
  const getAll = (store) =>
    new Promise((res, rej) => {
      const open = indexedDB.open('opensets-lb');
      open.onsuccess = () => {
        const dbx = open.result;
        const tx = dbx.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      };
      open.onerror = () => rej(open.error);
    });
  const programs = await getAll('programs');
  const templates = await getAll('templates');
  return { programs, templates };
});

const prog = data.programs.find((x) => x.isActive) ?? data.programs[0] ?? {};
const tpls = (data.templates ?? []).filter((t) => t.programId === prog.id).sort((a, b) => a.dayIndex - b.dayIndex);
const allSets = tpls.flatMap((t) => (t.slots ?? []).map((s) => s.scheme?.sets ?? 0));
const distinctSets = [...new Set(allSets)].sort((a, b) => a - b);
// within-muscle doubling: some session has 2 slots sharing an exerciseId root muscle —
// approximated by a session whose slot count exceeds the # of distinct movement patterns
// it would have under the old 1-per-pattern model (>5 slots in a day, or repeated press).
const maxSlotsInDay = Math.max(...tpls.map((t) => (t.slots ?? []).length));
const perDaySets = tpls.map((t) => `${t.name}:${(t.slots ?? []).map((s) => s.scheme?.sets).join('+')}`);

const checks = {
  'active program persisted with templates': tpls.length >= 5,
  'slots persisted with set counts': allSets.length > 0,
  'set counts VARY by muscle (not flat sets:3)': distinctSets.length > 1 && Math.max(...allSets) > 3,
  'doubling present (a session has > 5 slots OR a 4+ set slot)': maxSlotsInDay > 5 || Math.max(...allSets) >= 4,
  'no page errors': errors.length === 0,
};

await page.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: '.shots/r3-today.png', fullPage: true });

console.log('--- R3 allocation-at-storage checks ---');
let allPass = true;
for (const [k, v] of Object.entries(checks)) {
  console.log(`${v ? 'PASS' : 'FAIL'}  ${k}`);
  if (!v) allPass = false;
}
console.log('distinct set counts across plan:', distinctSets.join(', '));
console.log('per-day set counts:');
for (const d of perDaySets) console.log('   ', d);
console.log('pageerrors:', errors.length ? errors.join(' | ') : 'none');
console.log(allPass ? '\nR3 VERIFY: ALL PASS' : '\nR3 VERIFY: FAILURES PRESENT');
await browser.close();
process.exit(allPass ? 0 : 1);
