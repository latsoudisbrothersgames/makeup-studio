import { chromium } from 'playwright-core';
const faces = process.argv.slice(2).length ? process.argv.slice(2) : ['f1'];
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const f of faces) {
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  await p.goto(`http://localhost:5174/?test=1#/studio?face=${f}&new=1&debug=1`);
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__studio?.ready === true);
  await p.evaluate(() => { window.__studio.freeze(true); window.__studio.apply('lipstick', '#c2185b'); window.__studio.apply('blush', '#ff8fa3'); window.__studio.apply('eyeshadow', '#7e57c2'); window.__studio.apply('eyeliner', '#1a1a1a'); window.__studio.apply('brow', '#5d4037'); });
  await p.waitForTimeout(300);
  const el = await p.$('.face-stage__frame');
  await el.screenshot({ path: `tools/shots/debug-${f}.png` });
  await p.close();
}
await b.close(); console.log('ok');
