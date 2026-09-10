// Πασαρέλα + άλμπουμ: Σαλόνι → ετυμηγορία → Πασαρέλα (στιγμιότυπο μέσα στην επίδειξη) → φωτογραφία → άλμπουμ με σήμα Σαλόνι· Στούντιο → αποθήκευση → πασαρέλα.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];
for (const [name, opts] of [['desktop', { viewport: { width: 1200, height: 900 } }], ['iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage(opts);
  p.on('pageerror', (e) => errs.push(`${name}: ${e}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
  await p.goto('http://localhost:5174/?test=1#/');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('makeupStudio:lastModelName:v1', JSON.stringify('Αίλια')); });
  await p.goto('http://localhost:5174/?test=1#/salon'); await p.reload();
  await p.waitForSelector('[data-action="salon-open"]'); await p.click('[data-action="salon-open"]');
  await p.waitForSelector('[data-action="salon-start"]'); await p.waitForFunction(() => window.__salon?.ready === true);
  await p.evaluate(() => window.__salon.call('costume-cat')); await p.waitForTimeout(300);
  await p.click('[data-action="salon-start"]'); await p.waitForTimeout(200);
  await p.evaluate(() => window.__salon.apply({ category: 'facePaint', color: '#1a1a1a', variant: 'cat', regionIds: ['skin'] }));
  await p.waitForTimeout(300);
  await p.click('[data-action="salon-done"]'); await p.waitForSelector('[data-action="salon-catwalk"]');
  await p.click('[data-action="salon-catwalk"]');
  await p.waitForSelector('.catwalk'); await p.waitForTimeout(2900); // μέσα στο «wow»
  const mid = await p.evaluate(() => ({ phase: document.querySelector('.catwalk').dataset.phase, step: document.querySelector('.catwalk').dataset.step, confetti: document.querySelectorAll('.catwalk__piece').length }));
  await p.screenshot({ path: `tools/shots/catwalk-${name}-show.png` });
  await p.waitForSelector('[data-action="catwalk-done"]', { timeout: 8000 }); await p.waitForTimeout(500);
  const photo = await p.$('[data-photo]');
  await p.screenshot({ path: `tools/shots/catwalk-${name}-photo.png` });
  await p.click('[data-action="catwalk-done"]'); await p.waitForSelector('[data-action="salon-start"]');
  const album = await p.evaluate(() => JSON.parse(localStorage.getItem('makeupStudio:gallery:v1') || '[]').map((x) => ({ kind: x.kind, name: x.projectName, customer: x.customer, stars: x.stars, thumb: x.thumb.length > 100 })));
  // Γκαλερί
  await p.goto('http://localhost:5174/?test=1#/gallery'); await p.waitForSelector('[data-project]'); await p.waitForTimeout(300);
  const badge = await p.$eval('[data-badge="salon"]', (e) => e.textContent).catch(() => 'NO BADGE');
  await p.screenshot({ path: `tools/shots/catwalk-${name}-album.png` });
  // Στούντιο: αποθήκευση → πασαρέλα
  await p.goto('http://localhost:5174/?test=1#/studio?face=f2&new=1'); await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.evaluate(() => window.__studio.apply('lipstick', '#e53935'));
  await p.waitForTimeout(200);
  await p.evaluate(() => window.__studio.saveAs('Το στυλ μου', 'Αίλια')); await p.waitForTimeout(400);
  const studioCatwalk = !!(await p.$('.catwalk'));
  await p.waitForSelector('[data-action="catwalk-done"]', { timeout: 9000 }); await p.click('[data-action="catwalk-done"]');
  console.log(`${name}: mid=${JSON.stringify(mid)} photo=${!!photo} album=${JSON.stringify(album)} badge="${badge}" studioCatwalk=${studioCatwalk}`);
  await p.close();
}
await b.close(); console.log(errs.length ? errs.join('\n') : 'no errors');
