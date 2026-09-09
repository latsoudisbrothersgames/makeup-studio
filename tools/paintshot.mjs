// Μπογιές προσώπου + μολύβι χειλιών + έλεγχος βαμβακιού. node tools/paintshot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const out = [];
const shots = [['f1', 'cat', 'neutral'], ['f4', 'rainbow', 'smile'], ['f3', 'cat', 'wow'], ['f2', 'rainbow', 'neutral']];
for (const [f, v, expr] of shots) {
  const p = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`http://localhost:5174/?test=1#/studio?face=${f}&new=1`);
  await p.waitForSelector('[data-face-ready="1"]', { timeout: 20000 });
  await p.waitForFunction(() => window.__studio?.ready === true);
  const n = await p.evaluate(([v, expr]) => {
    const s = window.__studio;
    s.freeze(true);
    s.apply('facePaint', v === 'cat' ? '#1a1a1a' : '#e53935', { variant: v });
    s.apply('lipstick', '#f06292');
    s.apply('lipLiner', '#8e1b3a');
    s.apply('blush', '#ff8fa3');
    const before = s.getLayers().length;
    // βαμβάκι στο ρουζ (αριστερό μάγουλο) → πρέπει να φύγει το ρουζ, όχι η μπογιά
    s.apply('remover', '#ffffff');
    const after = s.getLayers().map((l) => l.category);
    s.setExpression(expr);
    return { before, after };
  }, [v, expr]);
  await p.waitForTimeout(400);
  const el = await p.$('.face-stage__frame');
  await el.screenshot({ path: `tools/shots/paint-${f}.png` });
  out.push(`${f} ${v}/${expr}: layers before=${n.before} after=[${n.after.join(',')}] · ${errs.length ? errs.join(' | ') : 'no console issues'}`);
  await p.close();
}
await b.close(); console.log(out.join('\n'));
