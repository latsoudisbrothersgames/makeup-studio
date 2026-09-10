// Ακρίβεια αφής: αυτοκόλλητο ακριβώς εκεί που είναι το δάχτυλο (πηγούνι = 70 μονάδες κάτω από τα χείλη) + στιγμιότυπο με το σημάδι στόχου.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto('http://localhost:5174/?test=1#/studio?face=f3&new=1');
await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
const cdp = await p.context().newCDPSession(p);
await p.click('.panel__group:has-text("Έξτρα")'); await p.click('[data-category="sticker"]'); await p.waitForTimeout(200);
const sw = await p.$('.panel__variants .swatch'); const sb = await sw.boundingBox();
const lips = await p.evaluate(() => window.__studio.regionCenterClient('lips'));
const stage = await (await p.$('.studio__stage')).boundingBox(); const scale = stage.width / 512;
const tx = lips.x, ty = lips.y + 70 * scale; // πηγούνι
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 }] });
for (let i = 1; i <= 20; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sb.x + sb.width / 2 + (tx - sb.x - sb.width / 2) * i / 20, y: sb.y + sb.height / 2 + (ty - sb.y - sb.height / 2) * i / 20 }] }); await p.waitForTimeout(16); }
await p.waitForTimeout(150);
await p.screenshot({ path: 'tools/shots/fingerdrop-mid.png' });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.waitForTimeout(400);
const l = await p.evaluate(() => window.__studio.getLayers().at(-1));
const lipsFace = await p.evaluate(() => { const c = window.__studio.regionCenterClient('lips'); return c; });
console.log('sticker anchor (face units):', l?.anchor ?? l, '· expected ≈ lips +70 below');
await p.screenshot({ path: 'tools/shots/fingerdrop-after.png' });
await b.close();
