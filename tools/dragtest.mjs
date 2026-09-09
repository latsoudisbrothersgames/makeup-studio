// Πραγματικό σύρσιμο αυτοκόλλητου από το panel σε 3 σημεία του προσώπου (desktop + iPhone viewport).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const run = async (name, ctxOpts) => {
  const p = await b.newPage(ctxOpts);
  await p.goto('http://localhost:5174/?test=1#/studio?face=f1&new=1');
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__studio?.ready === true);
  await p.evaluate(() => window.__studio.freeze(true));
  await p.click('text=Έξτρα');
  await p.waitForTimeout(200);
  await p.click('[data-category="sticker"]');
  await p.waitForSelector('[data-swatch="sticker:star"]');
  const bb = await (await p.$('[data-swatch="sticker:star"]')).boundingBox();
  const sw = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  const targets = { cheekL: [205, 290], forehead: [268, 190], cheekR: [331, 290] };
  const out = [];
  for (const [label, fp] of Object.entries(targets)) {
    const tc = await p.evaluate((fp) => { const c = document.querySelector('.face-stage__frame canvas'); const r = c.getBoundingClientRect(); return { x: r.left + (fp[0] / 512) * r.width, y: r.top + (fp[1] / 512) * r.height }; }, fp);
    await p.mouse.move(sw.x, sw.y); await p.mouse.down();
    for (let i = 1; i <= 12; i++) await p.mouse.move(sw.x + ((tc.x - sw.x) * i) / 12, sw.y + ((tc.y - sw.y) * i) / 12);
    await p.mouse.up();
    await p.waitForTimeout(250);
    const at = await p.evaluate(() => { const ls = window.__studio.getLayers(); return ls[ls.length - 1]?.at; });
    out.push(`${label} target=${fp} → at=${at ? at.map(Math.round) : 'NONE'}`);
  }
  await p.close();
  console.log(`${name}:\n  ${out.join('\n  ')}`);
};
await run('desktop 1600×1000', { viewport: { width: 1600, height: 1000 } });
await run('iphone 390×844', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await b.close();
