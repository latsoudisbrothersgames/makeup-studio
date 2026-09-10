import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto('http://localhost:5174/?test=1#/studio?face=f2&new=1');
await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
const cdp = await p.context().newCDPSession(p);
async function swipe(x0, y0, x1, y1, steps = 20) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }] }); await p.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
await p.click('.panel__group:has-text("Έξτρα")'); await p.click('[data-category="glitter"]'); await p.waitForTimeout(200);
const sw = await p.$('.panel__swatches .swatch'); const sb = await sw.boundingBox();
const stage = await (await p.$('.studio__stage')).boundingBox(); const scale = stage.width / 512;
const cheek = await p.evaluate(() => window.__studio.regionCenterClient('cheekL'));
for (const [dx, label] of [[-45, '18 μονάδες έξω από το δέρμα'], [-55, '28 έξω'], [-75, '48 έξω (πρέπει να απορριφθεί)']]) {
  const n0 = await p.evaluate(() => window.__studio.getLayers().length);
  await swipe(sb.x + sb.width / 2, sb.y + sb.height / 2, cheek.x + dx * scale, cheek.y);
  await p.waitForTimeout(400);
  const ls = await p.evaluate(() => window.__studio.getLayers());
  console.log(label, '→', ls.length > n0 ? `APPLIED at ${JSON.stringify(ls.at(-1).anchor)}` : 'rejected');
}
await b.close();
