// Αστέρια/ξεκλειδώματα + δύο παίκτες: ροή και στιγμιότυπα (iPhone). node tools/duoshot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
const log = [];
// 1) Κλειδωμένα με 0 αστέρια (στούντιο, όνομα «Ελένη Τεστ»)
await p.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1&model=Λίλη');
await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
await p.click('text=Μαλλιά'); await p.waitForTimeout(200);
const lockedSw = await p.$$eval('[data-locked="1"]', (els) => els.map((e) => e.dataset.swatch));
await p.click('[data-swatch="hairColor:#9a5ed8"]'); await p.waitForTimeout(200);
const lockToast = await p.evaluate(() => document.querySelector('.toast')?.textContent ?? '(no toast)');
await p.screenshot({ path: 'tools/shots/duo-locked.png' });
log.push(`locked swatches (0★): ${lockedSw.join(', ')} · toast: ${lockToast}`);
// 2) Solo νίκη → αστέρια + ξεκλείδωμα τιάρας (3★)
await p.goto('http://localhost:5174/?test=1#/game?face=f1');
await p.waitForFunction(() => window.__game?.ready === true);
await p.evaluate(() => window.__game.start(1)); await p.waitForTimeout(400);
await p.evaluate(() => window.__game.copyTarget()); await p.waitForTimeout(1200);
const res1 = await p.evaluate(() => ({ phase: window.__game.phase, gained: window.__game.gained, unlock: document.querySelector('[data-unlock]')?.textContent }));
await p.screenshot({ path: 'tools/shots/duo-solo-result.png' });
log.push(`solo result: ${JSON.stringify(res1)}`);
// 3) Αρχική με πίνακα
await p.goto('http://localhost:5174/?test=1#/');
await p.waitForSelector('[data-board]'); await p.waitForTimeout(300);
const board = await p.$eval('[data-board]', (e) => e.innerText.replace(/\n+/g, ' | '));
await p.screenshot({ path: 'tools/shots/duo-board.png', fullPage: true });
log.push(`board: ${board}`);
// 4) Δύο παίκτες
await p.goto('http://localhost:5174/?test=1#/game?face=f3');
await p.waitForFunction(() => window.__game?.ready === true);
await p.click('[data-mode-pick="duo"]'); await p.click('[data-level="1"]');
await p.waitForSelector('[data-field="player-0"]');
await p.fill('[data-field="player-0"]', 'Άννα'); await p.fill('[data-field="player-1"]', 'Μαρία');
await p.screenshot({ path: 'tools/shots/duo-names.png' });
await p.click('[data-action="names-go"]'); await p.waitForTimeout(400);
log.push(`handoff1: ${await p.$eval('#dialog-title', (e) => e.textContent)}`);
await p.screenshot({ path: 'tools/shots/duo-handoff.png' });
await p.click('[data-action="handoff-go"]'); await p.waitForTimeout(400);
await p.evaluate(() => { const g = window.__game; g.apply({ category: 'lipstick', color: '#e53935', regionIds: ['lips'] }); g.apply({ category: 'hairColor', color: '#4f86ea', regionIds: ['hair'] }); g.apply({ category: 'sticker', color: '#ff5c8a', variant: 'star', at: [205, 286] }); });
await p.waitForTimeout(500);
log.push(`create: phase=${await p.evaluate(() => window.__game.phase)} hint=${await p.$eval('.game__hint', (e) => e.textContent)} timer=${await p.$eval('[data-timer]', (e) => e.textContent)}`);
await p.screenshot({ path: 'tools/shots/duo-create.png' });
await p.click('[data-action="game-ready"]'); await p.waitForTimeout(400);
log.push(`handoff2: ${await p.$eval('#dialog-title', (e) => e.textContent)} · pending=${await p.evaluate(() => window.__game.handoffPending)}`);
await p.click('[data-action="handoff-go"]'); await p.waitForTimeout(400);
log.push(`copy: phase=${await p.evaluate(() => window.__game.phase)} total=${await p.evaluate(() => window.__game.total)} target=${await p.evaluate(() => window.__game.preset.map((l) => l.category).join(','))}`);
await p.screenshot({ path: 'tools/shots/duo-copy.png' });
await p.evaluate(() => window.__game.copyTarget()); await p.waitForTimeout(1200);
log.push(`result1: ${await p.$eval('#dialog-title', (e) => e.textContent)} · ${await p.$eval('.dialog__body', (e) => e.innerText.replace(/\n+/g, ' | '))}`);
await p.click('[data-action="game-again"]'); await p.waitForTimeout(400);
log.push(`handoff3: ${await p.$eval('#dialog-title', (e) => e.textContent)}`);
await p.click('[data-action="handoff-go"]'); await p.waitForTimeout(300);
await p.evaluate(() => { const g = window.__game; g.apply({ category: 'blush', color: '#ff8fa3', regionIds: ['cheekL', 'cheekR'] }); });
await p.waitForTimeout(300);
await p.click('[data-action="game-ready"]'); await p.waitForTimeout(300);
await p.click('[data-action="handoff-go"]'); await p.waitForTimeout(300);
// Άννα αντιγράφει λάθος (τίποτα) → τέλος χρόνου δεν περιμένουμε· βάζουμε το σωστό μισό: 0/1 → δοκιμάζουμε copyTarget για νίκη
await p.evaluate(() => window.__game.copyTarget()); await p.waitForTimeout(1200);
await p.click('[data-action="game-again"]'); await p.waitForTimeout(400);
log.push(`final: ${await p.$eval('#dialog-title', (e) => e.textContent)} · ${await p.$eval('.dialog__body', (e) => e.innerText.replace(/\n+/g, ' | '))}`);
await p.screenshot({ path: 'tools/shots/duo-final.png' });
await b.close();
console.log(log.join('\n'));
console.log(errs.length ? errs.join('\n') : 'no console issues');
