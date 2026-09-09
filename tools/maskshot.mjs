import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const out = [];
for (const f of ['f1', 'f3', 'f4', 'f2']) {
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://localhost:5174/?test=1#/studio?face=${f}&new=1`);
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__studio?.ready === true);
  await p.evaluate(() => { window.__studio.freeze(true); window.__studio.apply('mask', '#eaf4ff', { variant: 'sheet' }); window.__studio.apply('lipstick', '#c2185b'); window.__studio.apply('blush', '#ff8fa3'); });
  await p.waitForTimeout(400);
  const el = await p.$('.face-stage__frame');
  await el.screenshot({ path: `tools/shots/hair-on-top-${f}.png` });
  out.push(`${f}: ${errs.length ? errs.join(' | ') : 'no console issues'}`);
  await p.close();
}
await b.close(); console.log(out.join('\n'));
