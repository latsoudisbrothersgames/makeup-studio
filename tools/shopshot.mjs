// Κατάστημα: αγορά με αρκετά/λίγα νομίσματα, 🛒 στο panel πριν, ανοιχτό μετά, σκηνικό στη σκηνή. node tools/shopshot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];
for (const [name, opts] of [['desktop', { viewport: { width: 1200, height: 900 } }], ['iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage(opts);
  p.on('pageerror', (e) => errs.push(`${name}: ${e}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
  await p.goto('http://localhost:5174/?test=1#/');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('makeupStudio:players:v1', JSON.stringify({ 'ιόλη': { name: 'Ιόλη', stars: 4, games: 2, best: {}, coins: 45, updatedAt: '2026-09-10' } })); localStorage.setItem('makeupStudio:lastModelName:v1', JSON.stringify('Ιόλη')); });
  // panel: μπλε κραγιόν κλειδωμένο με 🛒
  await p.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1'); await p.reload();
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.click('.panel__group:has-text("Χείλη")'); await p.waitForTimeout(200);
  const before = await p.$eval('[data-swatch="lipstick:#1e88e5"]', (e) => ({ locked: e.dataset.locked, glyph: e.textContent.trim() }));
  await p.click('[data-swatch="lipstick:#1e88e5"]'); await p.waitForTimeout(200);
  const toast = await p.$('.toast'); const toastText = toast ? await toast.textContent() : '';
  // shop
  await p.goto('http://localhost:5174/?test=1#/shop'); await p.waitForSelector('[data-wallet]'); await p.waitForTimeout(300);
  const coins0 = await p.$eval('.shop__coins', (e) => e.textContent);
  await p.screenshot({ path: `tools/shots/shop-${name}-1.png`, fullPage: name === 'desktop' });
  await p.click('[data-item="lip-blue"] [data-action="buy"]'); await p.waitForTimeout(300);
  const coins1 = await p.$eval('.shop__coins', (e) => e.textContent);
  const ownedLabel = await p.$eval('[data-item="lip-blue"] .shop__owned', (e) => e.textContent).catch(() => 'NOT OWNED');
  const silverDisabled = await p.$eval('[data-item="hair-silver"] [data-action="buy"]', (e) => e.disabled);
  // σκηνικό: αγορά νύχτας (40) με 20 → όχι· καρδούλες (30) → όχι· άρα δοκιμή με stars bg? έχουμε 20 → κανένα. Δώσε νομίσματα.
  await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('makeupStudio:players:v1')); t['ιόλη'].coins = 100; localStorage.setItem('makeupStudio:players:v1', JSON.stringify(t)); window.dispatchEvent(new CustomEvent('makeup:players-changed')); });
  await p.waitForTimeout(200);
  await p.click('[data-item="bg-night"] [data-action="buy"]'); await p.waitForTimeout(300);
  const inUse = await p.$eval('[data-item="bg-night"] [data-inuse]', (e) => e.textContent).catch(() => 'NOT IN USE');
  await p.screenshot({ path: `tools/shots/shop-${name}-2.png`, fullPage: name === 'desktop' });
  // studio: unlocked swatch + night background
  await p.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1'); await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.click('.panel__group:has-text("Χείλη")'); await p.waitForTimeout(200);
  const after = await p.$eval('[data-swatch="lipstick:#1e88e5"]', (e) => e.dataset.locked ?? 'open');
  const bg = await p.$eval('.face-stage__frame', (e) => e.dataset.bg);
  const zoom = await p.evaluate(() => `vv.scale=${window.visualViewport?.scale} scrollW=${document.documentElement.scrollWidth}`);
  await p.screenshot({ path: `tools/shots/shop-${name}-3-studio.png` });
  console.log(`${name}: before=${JSON.stringify(before)} toast="${toastText}" · shop ${coins0} → buy blue → ${coins1}, ${ownedLabel}, silver disabled=${silverDisabled} · night bg: ${inUse} · studio: blue=${after}, bg=${bg} · ${zoom}`);
  await p.close();
}
await b.close(); console.log(errs.length ? errs.join('\n') : 'no errors');
