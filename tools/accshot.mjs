// Αξεσουάρ μαλλιών: 4 πρόσωπα με διαφορετικούς συνδυασμούς + panel «Στολίδια» (iPhone/desktop). node tools/accshot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];
const combos = {
  f1: [['clip', 'accL', '#ff7fbf', 'star'], ['bow', 'accR', '#4f86ea', null], ['band', 'accTop', '#3fd0c9', 'flower']],
  f2: [['band', 'accTop', '#e53935', null], ['clip', 'accR', '#f4f4f4', 'heart']],
  f3: [['tiara', 'accTop', '#f5b301', null], ['bow', 'accL', '#9a5ed8', 'butterfly']],
  f4: [['bow', 'accTop', '#ff7fbf', 'gem'], ['clip', 'accL', '#3fd0c9', null], ['clip', 'accR', '#3fd0c9', null]],
};
for (const [f, items] of Object.entries(combos)) {
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${f}: ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`${f}: ${e}`));
  await p.goto(`http://localhost:5174/?test=1#/studio?face=${f}&new=1`);
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__studio?.ready === true);
  await p.waitForTimeout(300);
  await p.evaluate((items) => {
    const s = window.__studio; s.freeze(true);
    for (const [v, slot, color, deco] of items) s.apply('accessory', color, { variant: v, regionId: slot });
    s.apply('hairColor', '#9a5ed8');
  }, items);
  await p.waitForTimeout(300);
  // deco μέσω απευθείας apply δεν υπάρχει στο hook → το κάνουμε με sticker drop στη θέση (resolveDrop → decorate)
  for (const [, slot] of items.filter((it) => it[3])) {
    const c = await p.evaluate((slot) => window.__studio.regionCenterClient(slot), slot);
    await p.click('text=Έξτρα'); await p.click('[data-category="sticker"]');
    const bb = await (await p.$(`[data-swatch="sticker:${deco}"]`)).boundingBox();
    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
    for (let i = 1; i <= 8; i++) await p.mouse.move(bb.x + ((c.x - bb.x) * i) / 8, bb.y + ((c.y - bb.y) * i) / 8);
    await p.mouse.up(); await p.waitForTimeout(250);
  }
  const layers = await p.evaluate(() => window.__studio.getLayers().filter((l) => l.category === 'accessory').map((l) => `${l.variant}@${l.regionIds[0]}${l.deco ? '+' + l.deco : ''}`));
  const el = await p.$('.face-stage__frame');
  await el.screenshot({ path: `tools/shots/acc-${f}.png` });
  console.log(`${f}: ${layers.join(', ')}`);
  await p.close();
}
const ip = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ip.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1');
await ip.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
await ip.click('text=Μαλλιά'); await ip.click('[data-category="accessory"]'); await ip.waitForTimeout(300);
await ip.screenshot({ path: 'tools/shots/acc-iphone.png' });
await b.close();
console.log(errs.length ? errs.join('\n') : 'no console issues');
