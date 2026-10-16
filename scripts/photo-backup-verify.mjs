// Photo backup verification (2026-10-15). On the built app: add a full-size phone
// photo through the Add photo tile, check it was shrunk, export a backup through the
// Settings button, erase everything, import the backup, and check the photo came back
// with identical bytes.
// Usage: npm run build, `npx vite preview --port 4173`, then `node scripts/photo-backup-verify.mjs`.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
mkdirSync('.shots', { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

/** Every stored photo: type, size, decoded dimensions and the bytes as base64. */
const readPhotos = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('opensets-lb');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const idb = open.result;
          if (!idb.objectStoreNames.contains('photos')) {
            idb.close();
            resolve([]);
            return;
          }
          const req = idb.transaction('photos', 'readonly').objectStore('photos').getAll();
          req.onerror = () => reject(req.error);
          req.onsuccess = async () => {
            const out = [];
            for (const p of req.result) {
              const bmp = await createImageBitmap(p.blob);
              const bytes = new Uint8Array(await p.blob.arrayBuffer());
              let bin = '';
              for (let i = 0; i < bytes.length; i += 0x8000) {
                bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
              }
              out.push({
                id: p.id,
                type: p.blob.type,
                size: p.blob.size,
                width: bmp.width,
                height: bmp.height,
                b64: btoa(bin),
              });
            }
            idb.close();
            resolve(out);
          };
        };
      }),
  );

// Fresh database.
await page.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await page.evaluate(
  () =>
    new Promise((res) => {
      const r = indexedDB.deleteDatabase('opensets-lb');
      r.onsuccess = r.onerror = r.onblocked = () => res();
    }),
);

// A 12 MP landscape JPEG, the size a phone camera produces.
const original = Buffer.from(
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 4032;
    c.height = 3024;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 4032, 3024);
    grad.addColorStop(0, '#2a4d8f');
    grad.addColorStop(1, '#e0a85c');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4032, 3024);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `hsl(${(i * 37) % 360} 60% 50%)`;
      g.fillRect((i * 97) % 4000, (i * 61) % 3000, 40, 40);
    }
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }),
  'base64',
);

// 1. Add it through the real Add photo tile.
await page.goto(`${BASE}#/measurements`, { waitUntil: 'networkidle' });
await page
  .locator('input[type="file"][accept="image/*"]')
  .first()
  .setInputFiles({ name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: original });
await page.getByRole('img', { name: 'Progress photo' }).first().waitFor({ timeout: 10000 });

const stored = await readPhotos();
check('one photo stored', stored.length === 1, String(stored.length));
const s = stored[0] ?? {};
check(
  'shrunk to 1600 px on the long edge',
  Math.max(s.width, s.height) === 1600,
  `${s.width}x${s.height} from 4032x3024`,
);
check(
  'stored smaller than the original',
  s.size < original.length,
  `${Math.round(s.size / 1024)} KB vs ${Math.round(original.length / 1024)} KB`,
);
check('stored as JPEG', s.type === 'image/jpeg', s.type);
await page.screenshot({ path: '.shots/photo-backup-1-added.png', fullPage: true });

// 2. Export through the Settings button (headless has no save picker, so the app
//    takes its download fallback).
await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  window.showSaveFilePicker = undefined;
});
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Export backup/ }).click(),
]);
const exportPath = '.shots/photo-backup-export.json';
await download.saveAs(exportPath);
const env = JSON.parse(readFileSync(exportPath, 'utf8'));
check('backup file carries the photo', env.data?.photos?.length === 1, String(env.data?.photos?.length));
check('backup photo bytes match the stored photo', env.data?.photos?.[0]?.base64 === s.b64);

// 3. Erase everything, as if the phone were lost.
await page.getByRole('button', { name: 'Erase all data' }).click();
await page.getByRole('button', { name: 'Erase everything' }).click();
await page.waitForTimeout(1500);
check('erase removed the photo', (await readPhotos()).length === 0);

// 4. Import the backup through the Settings button.
await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle' });
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.getByRole('button', { name: /Import backup/ }).click(),
]);
await chooser.setFiles(exportPath);
await page.getByRole('button', { name: 'Replace data' }).click();
await page.waitForTimeout(1500);

// 5. The photo is back, byte for byte, and on screen.
const back = await readPhotos();
check('photo restored', back.length === 1, String(back.length));
check('restored bytes identical', back[0]?.b64 === s.b64);
await page.goto(`${BASE}#/measurements`, { waitUntil: 'networkidle' });
const img = page.getByRole('img', { name: 'Progress photo' }).first();
await img.waitFor({ timeout: 10000 });
const shown = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
check('restored photo renders on Measurements', shown);
await page.screenshot({ path: '.shots/photo-backup-2-restored.png', fullPage: true });

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
