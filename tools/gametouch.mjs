// Παιχνίδι σε iPhone: επιλογή γκλίτερ + σύρσιμο αφής στο πρόσωπο του παίκτη. node tools/gametouch.mjs [level]
import { chromium } from 'playwright-core';
const level = process.argv[2] ?? '1';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto('http://localhost:5174/?test=1#/game?face=f2');
await p.waitForSelector(`[data-level="${level}"]`, { timeout: 20000 });
await p.waitForFunction(() => window.__game?.ready === true);
await p.click(`[data-level="${level}"]`); await p.waitForTimeout(600);
await p.screenshot({ path: 'tools/shots/gametouch-0.png' });
const cdp = await p.context().newCDPSession(p);
async function swipe(x0, y0, x1, y1, steps = 20) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }] }); await p.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
await p.click('.panel__group:has-text("Έξτρα")'); await p.waitForTimeout(200);
const cat = await p.$('[data-category="glitter"]'); const cb = await cat.boundingBox();
console.log('glitter tile box', cb && { x: Math.round(cb.x), y: Math.round(cb.y), w: Math.round(cb.width), h: Math.round(cb.height) });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.waitForTimeout(200);
const active = await p.evaluate(() => document.querySelector('.panel__cat.is-active')?.textContent);
console.log('active tool after tap:', active);
await p.screenshot({ path: 'tools/shots/gametouch-1.png' });
const stages = await p.$$('.game__stage'); const info = [];
for (const s of stages) { const bb = await s.boundingBox(); info.push({ cls: await s.getAttribute('class'), x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.width), h: Math.round(bb.height) }); }
console.log('stages', JSON.stringify(info));
const you = info.find(i => i.cls.includes('--you')) ?? info[1];
const sw = await p.$('.panel__swatches .swatch'); const sb = await sw.boundingBox();
const n0 = await p.evaluate(() => window.__game.layers?.length ?? window.__game.found);
await swipe(sb.x + sb.width / 2, sb.y + sb.height / 2, you.x + you.w / 2, you.y + you.h * 0.45 + 56, 24);
await p.waitForTimeout(500);
const n1 = await p.evaluate(() => window.__game.layers?.length ?? window.__game.found);
console.log('glitter touch-drag to cheek: layers/found', n0, '→', n1);
await p.screenshot({ path: 'tools/shots/gametouch-2.png' });
await b.close();
