// Στιγμιότυπα βαφής μαλλιών + τούφας στα 4 πρόσωπα (θέλει dev server). node tools/hairshot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const combos = process.argv.includes('--ui') ? [] : [['f1', '#9a5ed8', '#3fd0c9'], ['f2', '#e9c56b', '#ff7fbf'], ['f3', '#1a1822', '#c95e2c'], ['f4', '#ff7fbf', '#4f86ea']];
const out = [];
for (const [f, base, streak] of combos) {
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://localhost:5174/?test=1#/studio?face=${f}&new=1`);
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__studio?.ready === true);
  await p.evaluate(([base, streak]) => { window.__studio.freeze(true); window.__studio.apply('hairColor', base); window.__studio.apply('hairStreak', streak); window.__studio.apply('mask', '#eaf4ff', { variant: 'sheet' }); }, [base, streak]);
  await p.waitForTimeout(400);
  const el = await p.$('.face-stage__frame');
  await el.screenshot({ path: `tools/shots/hair-color-${f}.png` });
  out.push(`${f}: ${errs.length ? errs.join(' | ') : 'no console issues'}`);
  await p.close();
}
// iPhone: ομάδα «Μαλλιά» ανοιχτή
const ip = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ip.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1');
await ip.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
await ip.click('text=Μαλλιά');
await ip.waitForTimeout(300);
await ip.screenshot({ path: 'tools/shots/hair-iphone.png' });
const dp = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await dp.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1');
await dp.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
await dp.click('text=Μαλλιά');
await dp.waitForTimeout(300);
await dp.screenshot({ path: 'tools/shots/hair-desktop.png' });
await b.close(); console.log(out.join('\n'));
