// Κάρτες + φωτογραφία: iPhone και desktop. node tools/step3shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];
const setup = async (p, face) => {
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://localhost:5174/?test=1#/studio?face=${face}&new=1`);
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__studio?.ready === true);
};
// iPhone: κάρτα ενεργή + πρόοδος στη hintbar
const ip = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await setup(ip, 'f1');
await ip.evaluate(() => { window.__studio.freeze(true); window.__studio.apply('hairColor', '#9a5ed8'); });
await ip.click('[data-action="ideas"]');
await ip.waitForSelector('[data-card="purple-star"]');
await ip.waitForTimeout(500);
await ip.screenshot({ path: 'tools/shots/s3-iphone-cards.png' });
await ip.click('[data-card="purple-star"]');
await ip.waitForTimeout(300);
await ip.screenshot({ path: 'tools/shots/s3-iphone-progress.png' });
await ip.evaluate(() => window.__studio.apply('sticker', '#ff5c8a', { variant: 'star', at: [330, 250] }));
await ip.waitForTimeout(500);
const toast = await ip.evaluate(() => document.querySelector('.toast')?.textContent ?? '(no toast)');
await ip.click('[data-action="photo"]');
await ip.waitForSelector('[data-action="photo-save"]');
await ip.waitForTimeout(400);
await ip.screenshot({ path: 'tools/shots/s3-iphone-photo.png' });
await ip.close();
// Desktop: πλήρες στούντιο + λήψη φωτογραφίας (download event)
const dp = await b.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
await setup(dp, 'f3');
await dp.evaluate(() => { window.__studio.freeze(true); window.__studio.apply('facePaint', '#e53935', { variant: 'rainbow' }); window.__studio.apply('lipstick', '#f06292'); });
await dp.waitForTimeout(300);
await dp.screenshot({ path: 'tools/shots/s3-desktop.png' });
await dp.click('[data-action="photo"]');
await dp.waitForSelector('[data-action="photo-save"]');
await dp.click('[data-bg="dots"]');
await dp.waitForTimeout(300);
const [dl] = await Promise.all([dp.waitForEvent('download', { timeout: 8000 }).catch(() => null), dp.click('[data-action="photo-save"]')]);
let dlInfo = 'no download';
if (dl) { const path = 'tools/shots/s3-photo-download.png'; await dl.saveAs(path); dlInfo = `download ${dl.suggestedFilename()} → ${path}`; }
await dp.waitForTimeout(300);
const toast2 = await dp.evaluate(() => document.querySelector('.toast')?.textContent ?? '(no toast)');
await dp.close();
await b.close();
console.log(`iphone card toast: ${toast}\ndesktop: ${dlInfo} · toast: ${toast2}\n${errs.length ? errs.join('\n') : 'no console issues'}`);
