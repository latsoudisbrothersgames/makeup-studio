// Παιχνίδι «Αντίγραψε το στυλ»: ροή + στιγμιότυπα (desktop + iPhone). node tools/gameshot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];
const run = async (name, opts) => {
  const p = await b.newPage(opts);
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`${name}: ${e}`));
  await p.goto('http://localhost:5174/?test=1#/game?face=f3');
  await p.waitForSelector('[data-level="2"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__game?.ready === true);
  await p.screenshot({ path: `tools/shots/game-${name}-intro.png` });
  await p.click('[data-level="2"]');
  await p.waitForTimeout(600);
  const preset = await p.evaluate(() => window.__game.preset.map((l) => `${l.category}${l.variant ? ':' + l.variant : ''}`));
  // Αντιγραφή 2 από τα 5 με το χέρι (ίδια χρώματα/θέσεις) → πρόοδος
  await p.evaluate(() => { const g = window.__game; g.preset.slice(0, 2).forEach((l) => g.apply({ ...l, id: undefined })); });
  await p.waitForTimeout(500);
  const partial = await p.evaluate(() => `${window.__game.found}/${window.__game.total} · timer ${document.querySelector('[data-timer]').textContent}`);
  await p.screenshot({ path: `tools/shots/game-${name}-play.png` });
  await p.evaluate(() => window.__game.copyTarget());
  await p.waitForTimeout(1200);
  const result = await p.evaluate(() => ({ phase: window.__game.phase, stars: document.querySelector('.game__stars')?.textContent, title: document.querySelector('#dialog-title')?.textContent }));
  await p.screenshot({ path: `tools/shots/game-${name}-result.png` });
  await p.close();
  console.log(`${name}: preset=[${preset.join(', ')}] · partial=${partial} · result=${JSON.stringify(result)}`);
};
await run('desktop', { viewport: { width: 1600, height: 1000 } });
await run('iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await b.close();
console.log(errs.length ? errs.join('\n') : 'no console issues');
