// Αρχική: κουμπί «Τι ξεκλειδώνουν τα αστέρια;» → διάλογος με βαθμίδες (desktop + iPhone), και οι διάλογοι του Σαλονιού σε στενό παράθυρο.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];
for (const [name, opts] of [['desktop', { viewport: { width: 1100, height: 900 } }], ['iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const p = await b.newPage(opts);
  p.on('pageerror', (e) => errs.push(`${name}: ${e}`));
  await p.goto('http://localhost:5174/?test=1#/');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('makeupStudio:players:v1', JSON.stringify({ 'αίλια': { name: 'Αίλια', stars: 7, games: 3, best: {}, coins: 40, updatedAt: '2026-09-10' } })); localStorage.setItem('makeupStudio:lastModelName:v1', JSON.stringify('Αίλια')); });
  await p.reload(); await p.waitForSelector('[data-action="unlocks"]');
  await p.click('[data-action="unlocks"]'); await p.waitForSelector('[data-unlocks]'); await p.waitForTimeout(400);
  const tiers = await p.$$eval('[data-unlocks] li', (els) => els.map((e) => `${e.dataset.tier}★:${e.dataset.open === '1' ? 'open' : 'locked'}`));
  console.log(`${name}: tiers ${tiers.join(' ')}`);
  await p.screenshot({ path: `tools/shots/unlocks-${name}.png` });
  const ok = await p.$('[data-action="unlocks-ok"]'); await ok.scrollIntoViewIfNeeded(); await ok.click({ timeout: 5000 });
  console.log(`${name}: OK button reachable ✓`);
  await p.goto('http://localhost:5174/?test=1#/salon'); await p.waitForSelector('[data-action="salon-open"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: `tools/shots/salon-intro-${name}.png` });
  await p.close();
}
await b.close(); console.log(errs.length ? errs.join('\n') : 'no page errors');
