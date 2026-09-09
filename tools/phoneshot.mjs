// Στιγμιότυπο iPhone (390×844) του στούντιο με ανοιχτή ομάδα: node tools/phoneshot.mjs [Χείλη] [f3]
import { chromium } from 'playwright-core';
const [group = 'Χείλη', face = 'f3'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(`http://localhost:5174/?test=1#/studio?face=${face}&new=1`);
await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
await p.click(`text=${group}`);
await p.waitForTimeout(300);
await p.screenshot({ path: `tools/shots/phone-${group}.png` });
await b.close(); console.log(`tools/shots/phone-${group}.png`);
