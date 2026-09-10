// Σαλόνι: ροή όνομα → άνοιγμα → πελάτισσα → δουλειά → ετυμηγορία → επόμενη, σε desktop + iPhone. node tools/salonshot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];
async function run(name, opts) {
  const p = await b.newPage(opts);
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`${name}: ${e}`));
  await p.goto('http://localhost:5174/?test=1#/');
  await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:5174/?test=1#/salon'); await p.reload();
  await p.waitForSelector('[data-field="player"]', { timeout: 20000 });
  await p.fill('[data-field="player"]', 'Αίλια');
  await p.click('[data-action="name-go"]');
  await p.waitForSelector('[data-action="salon-open"]');
  await p.screenshot({ path: `tools/shots/salon-${name}-intro.png` });
  await p.click('[data-action="salon-open"]');
  await p.waitForSelector('[data-action="salon-start"]');
  await p.waitForFunction(() => window.__salon?.ready === true);
  // Συγκεκριμένο αίτημα για επαλήθευση: γάμος (λάμψη + κραγιόν + όχι κόκκινο)
  await p.evaluate(() => window.__salon.call('wedding'));
  await p.waitForTimeout(300);
  const req = await p.textContent('[data-request]');
  await p.screenshot({ path: `tools/shots/salon-${name}-arrive.png` });
  await p.click('[data-action="salon-start"]'); await p.waitForTimeout(300);
  const hint = await p.textContent('[data-hint]');
  // Λάθος: κόκκινο κραγιόν + λάμψη → 2/3
  await p.evaluate(() => { const s = window.__salon; s.apply({ category: 'highlighter', color: '#fff3c4', regionIds: ['cheekboneL', 'cheekboneR'] }); s.apply({ category: 'lipstick', color: '#e53935', regionIds: ['lips'] }); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `tools/shots/salon-${name}-work.png` });
  await p.click('[data-action="salon-done"]');
  await p.waitForSelector('[data-checklist]', { timeout: 5000 });
  const v1 = await p.evaluate(() => ({ stars: window.__salon.verdict.stars, ok: window.__salon.verdict.ok, coins: window.__salon.coins, gained: window.__salon.gained }));
  const checks1 = await p.$$eval('[data-checklist] li', (els) => els.map((e) => `${e.dataset.ok === '1' ? '✓' : '✗'} ${e.textContent.trim().replace(/^[✓✗]\s*/, '')}`));
  await p.screenshot({ path: `tools/shots/salon-${name}-verdict1.png` });
  // Διόρθωση: ροζ κραγιόν → 3/3, πληρωμή μόνο της διαφοράς
  await p.click('[data-action="salon-fix"]'); await p.waitForTimeout(200);
  await p.evaluate(() => window.__salon.apply({ category: 'lipstick', color: '#f06292', regionIds: ['lips'] }));
  await p.waitForTimeout(300);
  await p.click('[data-action="salon-done"]');
  await p.waitForSelector('[data-checklist]', { timeout: 5000 });
  const v2 = await p.evaluate(() => ({ stars: window.__salon.verdict.stars, coins: window.__salon.coins, gained: window.__salon.gained, served: window.__salon.served }));
  await p.screenshot({ path: `tools/shots/salon-${name}-verdict2.png` });
  await p.click('[data-action="salon-next"]');
  await p.waitForSelector('[data-action="salon-start"]');
  const next = await p.evaluate(() => ({ face: window.__salon.customer.face, brief: window.__salon.customer.brief.id, layers: window.__salon.layers.length }));
  console.log(`${name}: «${req}» · hint="${hint}"\n  verdict1 ${v1.ok}/3 ${v1.stars}★ coins=${v1.coins} (+${v1.gained.coins}) → [${checks1.join(' | ')}]\n  verdict2 ${v2.stars}★ coins=${v2.coins} (+${v2.gained.coins}, +${v2.gained.stars}★) served=${v2.served}\n  next: ${next.brief} on ${next.face}, layers=${next.layers}`);
  await p.close();
}
await run('desktop', { viewport: { width: 1600, height: 1000 } });
await run('iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await b.close();
console.log(errs.length ? errs.join('\n') : 'no console issues');
