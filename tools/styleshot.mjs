// Χτένισμα «Καρέ» στην Ελένη: βάση+μαλλιά ανά έκφραση, βαφή, τούφα, μάσκα, αξεσουάρ· panel Χτένισμα. node tools/styleshot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];
const shots = [
  ['a', 'neutral', (s) => { s.apply('hairstyle', '#e9c56b', { variant: 'bob' }); }],
  ['b', 'smile', (s) => { s.apply('hairstyle', '#e9c56b', { variant: 'bob' }); s.apply('hairColor', '#9a5ed8'); s.apply('hairStreak', '#3fd0c9'); s.apply('lipstick', '#c2185b'); }],
  ['c', 'wow', (s) => { s.apply('hairstyle', '#e9c56b', { variant: 'bob' }); s.apply('mask', '#eaf4ff', { variant: 'sheet' }); s.apply('accessory', '#ff7fbf', { variant: 'bow', regionId: 'accL' }); s.apply('accessory', '#f5b301', { variant: 'tiara', regionId: 'accTop' }); }],
  ['d', 'blink', (s) => { s.apply('hairstyle', '#e9c56b', { variant: 'bob' }); s.apply('facePaint', '#1a1a1a', { variant: 'cat' }); s.apply('hairstyle', '#e9c56b', { variant: 'original' }); }],
];
for (const [k, expr, fn] of shots) {
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1');
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__studio?.ready === true);
  await p.waitForTimeout(300);
  await p.evaluate((src) => { const s = window.__studio; s.freeze(true); (new Function('s', src))(s); }, `(${fn.toString()})(s)`);
  await p.waitForTimeout(300);
  await p.evaluate((e) => window.__studio.setExpression(e), expr);
  await p.waitForTimeout(400);
  const el = await p.$('.face-stage__frame');
  await el.screenshot({ path: `tools/shots/style-${k}.png` });
  await p.close();
}
const ip = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ip.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1');
await ip.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
await ip.click('text=Μαλλιά'); await ip.click('[data-category="hairstyle"]'); await ip.waitForTimeout(300);
await ip.screenshot({ path: 'tools/shots/style-panel-f1.png' });
await ip.goto('http://localhost:5174/?test=1#/studio?face=f2&new=1');
await ip.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
await ip.click('text=Μαλλιά'); await ip.click('[data-category="hairstyle"]'); await ip.waitForTimeout(300);
const f2variants = await ip.$$eval('[data-swatch^="hairstyle:"]', (els) => els.map((e) => e.dataset.swatch));
await b.close();
console.log('f2 hairstyle variants:', f2variants.join(', '));
console.log(errs.length ? errs.join('\n') : 'no console issues');
