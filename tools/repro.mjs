import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1');
await p.waitForSelector('[data-face-ready="1"]'); await p.waitForFunction(() => window.__studio?.ready === true);
await p.evaluate(() => window.__studio.freeze(true));
// open Διακόσμηση group → glitter
await p.click('.panel__group:nth-child(4)'); await p.waitForTimeout(100);
await p.click('[data-category="glitter"]'); await p.waitForTimeout(100);
const dragTo = async (sel, tx, ty) => {
  const r = await (await p.$(sel)).boundingBox();
  await p.mouse.move(r.x + r.width/2, r.y + r.height/2); await p.mouse.down();
  await p.mouse.move(r.x, r.y - 40, { steps: 4 }); await p.mouse.move(tx, ty, { steps: 15 });
  await p.mouse.up(); await p.waitForTimeout(300);
};
const cheek = await p.evaluate(() => window.__studio.regionCenterClient('cheekL'));
await dragTo('[data-swatch="glitter:#ffd54f"]', cheek.x, cheek.y);
console.log('after drop1: layers', await p.evaluate(() => window.__studio.getLayers().length), 'ghosts', await p.$$eval('.drag-ghost', g => g.length), 'dragging', await p.evaluate(() => document.body.classList.contains('is-dragging')));
await dragTo('[data-category="glitter"]', cheek.x + 20, cheek.y + 10);
console.log('after drop2: layers', await p.evaluate(() => window.__studio.getLayers().length), 'ghosts', await p.$$eval('.drag-ghost', g => g.length), 'dragging', await p.evaluate(() => document.body.classList.contains('is-dragging')));
// now click a category and a group button
await p.click('[data-category="sticker"]'); await p.waitForTimeout(150);
console.log('sticker active:', await p.$eval('[data-category="sticker"]', e => e.classList.contains('is-active')));
await p.click('.panel__group:nth-child(3)'); await p.waitForTimeout(150);
console.log('lips group active:', await p.$eval('.panel__group:nth-child(3)', e => e.classList.contains('is-active')));
await p.click('[data-action="undo"]'); await p.waitForTimeout(150);
console.log('after undo layers', await p.evaluate(() => window.__studio.getLayers().length));
await p.screenshot({ path: 'tools/shots/repro.png' });
console.log('errors:', errs);
await b.close();
