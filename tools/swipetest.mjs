// Δοκιμή αφής (CDP touch): οριζόντιο σάρωμα στη λωρίδα εργαλείων = κύλιση, κατακόρυφο σάρωμα από πλακίδιο = σύρσιμο.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto('http://localhost:5174/?test=1#/studio?face=f2&new=1');
await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
const cdp = await p.context().newCDPSession(p);
async function swipe(x0, y0, x1, y1, steps = 12) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await p.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
for (const group of ['Πρόσωπο', 'Μαλλιά']) {
  await p.click(`.panel__group:has-text("${group}")`); await p.waitForTimeout(300);
  const cats = await p.$('.panel__cats'); const cb = await cats.boundingBox();
  const m = await cats.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, ta: getComputedStyle(e.querySelector('.panel__cat')).touchAction }));
  const before = await cats.evaluate(e => e.scrollLeft);
  await swipe(cb.x + cb.width - 30, cb.y + cb.height / 2, cb.x + 30, cb.y + cb.height / 2, 16);
  await p.waitForTimeout(600);
  const after = await cats.evaluate(e => e.scrollLeft);
  const ghost = await p.$('body.is-dragging');
  console.log(`[${group}] tile touch-action=${m.ta} scrollWidth=${m.sw} clientWidth=${m.cw} scrollLeft ${before} → ${after}`, after > before + 5 ? 'SCROLLS ✓' : 'NO SCROLL ✗', ghost ? '(ghost stuck ✗)' : '');
  await p.screenshot({ path: `tools/shots/swipe-${group}.png` });
}
// κατακόρυφο σύρσιμο: κραγιόν → χείλη
await p.click(`.panel__group:has-text("Χείλη")`); await p.waitForTimeout(300);
const sw = await p.$('.panel__swatches .swatch'); const sb = await sw.boundingBox();
const lips = await p.evaluate(() => window.__studio.regionCenterClient('lips'));
const n0 = await p.evaluate(() => window.__studio.getLayers().length);
await swipe(sb.x + sb.width / 2, sb.y + sb.height / 2, lips.x, lips.y + 56, 24);
await p.waitForTimeout(600);
const n1 = await p.evaluate(() => window.__studio.getLayers().length);
console.log('lipstick drag: layers', n0, '→', n1, n1 > n0 ? 'APPLIED ✓' : 'NOT APPLIED ✗');
await p.screenshot({ path: 'tools/shots/swipe-drag.png' });
const panel = await p.$('.panel'); const sh = await panel.evaluate(e => [e.scrollHeight, e.clientHeight]);
console.log('panel scrollHeight/clientHeight', sh);
await b.close();
