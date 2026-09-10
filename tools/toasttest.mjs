// Παιχνίδι: πάτημα κλειδωμένου αυτοκόλλητου → το μήνυμα πρέπει να φύγει μόνο του ενώ τρέχει το χρονόμετρο.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.evaluate(() => localStorage.clear()).catch(() => {});
await p.goto('http://localhost:5174/?test=1#/game?face=f4');
await p.waitForSelector('[data-level="1"]', { timeout: 20000 });
await p.waitForFunction(() => window.__game?.ready === true);
await p.click('[data-level="1"]'); await p.waitForTimeout(500);
await p.click('.panel__group:has-text("Έξτρα")'); await p.click('[data-category="sticker"]'); await p.waitForTimeout(200);
const locked = await p.$('.panel__variants .swatch.is-locked');
if (!locked) { console.log('no locked variant found'); await b.close(); process.exit(1); }
await locked.tap();
await p.waitForTimeout(300);
const t0 = await p.$('.toast'); console.log('toast shown:', !!t0, t0 ? await t0.textContent() : '');
await p.waitForTimeout(3000);
const t1 = await p.$('.toast'); console.log('toast after 3s:', t1 ? 'STILL THERE ✗' : 'gone ✓');
await locked.tap(); await p.waitForTimeout(300);
const t2 = await p.$('.toast'); if (t2) { await t2.tap(); await p.waitForTimeout(200); }
console.log('tap to dismiss:', (await p.$('.toast')) ? 'STILL THERE ✗' : 'gone ✓');
await b.close();
