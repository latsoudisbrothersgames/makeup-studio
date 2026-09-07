#!/usr/bin/env node
// Στιγμιότυπα του Στούντιο Μακιγιάζ με τον εγκατεστημένο Chrome (playwright-core).
// Χρήση: npm run dev  →  node tools/shots.mjs [baseUrl] [outPrefix]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const base = process.argv[2] || 'http://localhost:5174';
const prefix = process.argv[3] || 'tools/shots/shot';
mkdirSync(dirname(prefix), { recursive: true });

const CONFIGS = [
  { name: 'desktop', viewport: { width: 1920, height: 1080 } },
  { name: 'laptop', viewport: { width: 1366, height: 768 } },
  { name: 'ipad', viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'iphone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

let failures = 0;
for (const cfg of CONFIGS) {
  const ctx = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: cfg.deviceScaleFactor ?? 1,
    isMobile: cfg.isMobile ?? false,
    hasTouch: cfg.hasTouch ?? false,
    locale: 'el-GR',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
  const shot = (n) => page.screenshot({ path: `${prefix}-${cfg.name}-${n}.png` });

  await page.goto(`${base}/?test=1#/`);
  await page.waitForSelector('[data-action="play"]');
  await shot('0-start');

  await page.goto(`${base}/?test=1#/studio?face=f1&model=%CE%A4%CE%B5%CF%83%CF%84&new=1`);
  await page.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await page.waitForFunction(() => window.__studio?.ready === true);
  await page.evaluate(() => window.__studio.freeze(true));
  await shot('1-empty');

  await page.evaluate(() => {
    window.__studio.apply('lipstick', '#c2185b');
    window.__studio.apply('blush', '#ff8fa3');
    window.__studio.apply('eyeshadow', '#7e57c2');
    window.__studio.apply('eyeliner', '#1a1a1a');
  });
  await page.waitForTimeout(150);
  await shot('2-makeup');

  // Πραγματικό σύρσιμο με το ποντίκι: κραγιόν → χείλη, με στιγμιότυπο στη μέση (λάμψη στόχου)
  const sw = await page.evaluate(() => window.__studio.swatchCenterClient('lipstick', '#ff5252'));
  const lips = await page.evaluate(() => window.__studio.regionCenterClient('lips'));
  if (sw) {
    await page.mouse.move(sw.x, sw.y);
    await page.mouse.down();
    await page.mouse.move((sw.x + lips.x) / 2, (sw.y + lips.y) / 2, { steps: 8 });
    await page.mouse.move(lips.x, lips.y, { steps: 12 });
    await page.waitForTimeout(80);
    await shot('3-drag-glow');
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.__studio.setExpression('smile'));
  await page.waitForTimeout(100);
  await shot('4-smile');
  await page.evaluate(() => { window.__studio.setExpression('wow'); window.__studio.apply('mask', '#eaf4ff', { variant: 'sheet' }); });
  await page.waitForTimeout(100);
  await shot('5-mask-wow');
  await page.evaluate(() => { window.__studio.setExpression(null); window.__studio.saveAs('Δοκιμή', 'Τεστ'); });
  await page.waitForTimeout(200);
  await page.goto(`${base}/?test=1#/gallery`);
  await page.waitForSelector('.gallery');
  await page.waitForTimeout(200);
  await shot('6-gallery');

  console.log(`${cfg.name}: ${errs.length === 0 ? 'no console errors' : errs.length + ' console issues'}`);
  for (const e of errs) console.log('   ' + e);
  if (errs.some((e) => e.startsWith('[pageerror]') || e.startsWith('[error]'))) failures++;
  await ctx.close();
}
await browser.close();
console.log(`done → ${prefix}-*.png${failures ? ` (${failures} config(s) with errors)` : ''}`);
process.exit(failures ? 1 : 0);
