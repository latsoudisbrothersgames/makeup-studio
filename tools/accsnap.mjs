// Αξεσουάρ σε κινητό: αφήνουμε τον φιόγκο ΜΑΚΡΙΑ από το κέντρο κάθε θέσης (60 μονάδες) και ελέγχουμε πού κούμπωσε.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const face = process.argv[2] ?? 'f2';
await p.goto(`http://localhost:5174/?test=1#/studio?face=${face}&new=1`);
await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
await p.click('.panel__group:has-text("Μαλλιά")'); await p.waitForTimeout(200);
await p.click('.panel__cat:has-text("Στολίδι")'); await p.waitForTimeout(200);
const cdp = await p.context().newCDPSession(p);
async function swipe(x0, y0, x1, y1, steps = 20) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }] });
    await p.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const bow = await p.$$('.panel__variants .swatch'); const bb = await bow[1].boundingBox(); // φιόγκος
const stage = await (await p.$('.studio__stage')).boundingBox();
const scale = stage.width / 512; // περίπου· η σκηνή είναι τετράγωνη
const tests = [['accL', -60, 40], ['accR', 60, 40], ['accTop', 0, -30], ['accL', -40, -50]]; // (θέση, dx, dy) σε μονάδες προσώπου
for (const [slot, dx, dy] of tests) {
  const c = await p.evaluate((id) => window.__studio.regionCenterClient(id), slot);
  const tx = c.x + dx * scale, ty = c.y + dy * scale;
  await swipe(bb.x + bb.width / 2, bb.y + bb.height / 2, tx, ty);
  await p.waitForTimeout(400);
  const layers = await p.evaluate(() => window.__studio.getLayers().filter(l => l.category === 'accessory').map(l => l.regionIds[0]));
  console.log(`drop ${dx},${dy} from ${slot} →`, layers.at(-1) ?? 'NOTHING', layers.at(-1) === slot ? '✓' : '✗');
}
await p.screenshot({ path: 'tools/shots/accsnap.png' });
await b.close();
