#!/usr/bin/env node
// Smoke test for the app: node tools/smoke.cjs [--port N] [--size 1280x800]
// Serves the repo, drives index.html with Playwright (headless Chromium, software WebGL) and fails on any
// console error / page error. Prints one line per step.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('nf'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const args = process.argv.slice(2);
  let port = 0, size = [1280, 800];
  for (let i = 0; i < args.length; i++) { if (args[i] === '--port') port = +args[++i]; else if (args[i] === '--size') size = args[++i].split('x').map(Number); }
  const srv = await serve(port);
  port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
  await ctx.addInitScript(() => { try { localStorage.setItem('planner.help', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

  let failed = 0;
  const step = async (name, fn) => {
    const before = errors.length;
    try {
      const info = await fn();
      const newErr = errors.slice(before);
      if (newErr.length) throw new Error(newErr.join(' | '));
      console.log(`ok   ${name}${info ? '  ' + info : ''}`);
    } catch (e) { failed++; console.log(`FAIL ${name}: ${String(e.message).split('\n')[0].slice(0, 300)}`); }
  };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frames = (n = 3) => ev((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const eq = (a, b, what) => { if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`); };
  const count = () => ev(() => window.__app.state.items.length);

  await step('load', async () => {
    await page.goto(`http://127.0.0.1:${port}/index.html?view=orbit`, { waitUntil: 'load' });
    await page.waitForFunction('window.__READY === true', null, { timeout: 120000 });
    const n = await count();
    if (n < 10) throw new Error('too few initial items: ' + n);
    return `${n} items`;
  });
  for (const v of ['walk', 'orbit', 'plan']) {
    await step('view ' + v, async () => {
      await ev((x) => window.__app.setView(x), v); await frames();
      eq(await ev(() => window.__app.viewName), v, 'view');
      eq(await page.getAttribute('#view-' + v, 'aria-pressed'), 'true', 'switch');
    });
  }
  await step('walk move (keyboard)', async () => {
    await ev(() => window.__app.setView('walk'));
    const a = await ev(() => window.__app.view.getPose());
    await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
    const b = await ev(() => window.__app.view.getPose());
    if (Math.hypot(a.X - b.X, a.Y - b.Y) < 0.2) throw new Error('did not move');
  });
  await step('place via __app.place', async () => {
    const n = await count();
    const uid = await ev(() => window.__app.place('rose_bush', 6, 14, { rot: 30 }));
    if (!uid) throw new Error('no uid');
    eq(await count(), n + 1, 'count');
    await ev((u) => window.__app.remove(u), uid);
    eq(await count(), n, 'count after remove');
  });

  await ev(() => window.__app.setView('plan')); await frames();
  await step('place via catalogue click', async () => {
    const n = await count();
    if (!(await page.isVisible('#left'))) await page.click('#btn-catalog');
    await page.click('#card-apple');
    if (!(await page.isVisible('#placement-bar'))) throw new Error('placement bar hidden');
    const p = await ev(() => window.__app.project(14, 15));
    await page.mouse.move(p.x, p.y); await frames(2);
    await page.mouse.click(p.x, p.y);
    await frames(2);
    eq(await count(), n + 1, 'count');
    await page.keyboard.press('Escape'); await frames(2);
    if (await page.isVisible('#placement-bar')) throw new Error('placement not cancelled by Esc');
  });
  let uid;
  await step('select / drag-move / delete / undo', async () => {
    uid = await ev(() => window.__app.place('rose_bush', 5, 15));
    await frames(3);
    const p = await ev(() => window.__app.project(5, 15));
    await page.mouse.click(p.x, p.y); await frames(2);
    eq(await ev(() => window.__app.state.selection), uid, 'selection by click');
    if (!(await page.isVisible('#right'))) throw new Error('properties hidden');
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 40, p.y, { steps: 5 }); await page.mouse.move(p.x + 80, p.y, { steps: 5 });
    await page.mouse.up(); await frames(2);
    const it = await ev((u) => window.__app.state.find(u), uid);
    if (it.X < 5.5) throw new Error('item not moved, X=' + it.X);
    await page.keyboard.press('Delete'); await frames(2);
    eq(await ev((u) => !!window.__app.state.find(u), uid), false, 'deleted');
    await page.keyboard.press('Control+z'); await frames(2);
    eq(await ev((u) => !!window.__app.state.find(u), uid), true, 'undo restored');
    return 'X=' + it.X.toFixed(1);
  });
  await step('properties: rotation + age', async () => {
    await ev((u) => window.__app.select(u), uid);
    await page.fill('#prop-rot', '90').catch(() => {});
    await ev(() => { const r = document.getElementById('prop-rot'); r.value = 90; r.dispatchEvent(new Event('input', { bubbles: true })); });
    eq(await ev((u) => window.__app.state.find(u).rot, uid), 90, 'rot');
  });
  await step('year slider', async () => {
    await ev(() => { const r = document.getElementById('year-slider'); r.value = 10; r.dispatchEvent(new Event('input', { bubbles: true })); });
    eq(await ev(() => window.__app.state.year), 10, 'year'); await page.waitForTimeout(400); await frames(2);
    await ev(() => window.__app.setYear(0));
  });
  await step('time change', async () => {
    await page.selectOption('#month-select', '12');
    eq(await ev(() => window.__app.state.time.month), 12, 'month');
    await ev(() => window.__app.setTime({ month: 7, hour: 15 })); await frames(2);
    eq(await ev(() => window.__app.state.time.hour), 15, 'hour');
  });
  await step('photo on/off', async () => {
    await ev(() => window.__app.setView('orbit'));
    await ev(() => window.__app.setYear(3));
    await ev(() => window.__app.enterPhoto('IMG_4010', 0.5)); await frames(3);
    if (!(await page.isVisible('#photo-overlay'))) throw new Error('overlay hidden');
    eq(await ev(() => window.__app.state.time.month), 10, 'photo month');
    eq(await ev(() => window.__app.state.year), 0, 'photo year');
    await page.click('#photo-exit'); await frames(3);
    if (await page.isVisible('#photo-overlay')) throw new Error('overlay still visible');
    eq(await ev(() => window.__app.viewName), 'orbit', 'restored view');
    eq(await ev(() => window.__app.state.year), 3, 'restored year');
    eq(await ev(() => window.__app.state.time.month), 7, 'restored month');
    await ev(() => window.__app.setYear(0));
  });
  await step('plan tools (grid, satellite, labels)', async () => {
    await ev(() => window.__app.setView('plan'));
    await page.click('#tool-grid'); await page.click('#tool-sat'); await page.click('#tool-labels'); await frames(3);
    const n = await page.locator('.item-label').count();
    await page.click('#tool-labels'); await page.click('#tool-sat'); await page.click('#tool-grid');
    return n + ' labels';
  });
  await step('export -> reset -> import', async () => {
    const plan = await ev(() => { window.__app.place('thuja_smaragd', 3, 12); return window.__app.exportPlan(); });
    const n = plan.items.length;
    await ev(() => window.__app.reset());
    const n2 = await count();
    if (n2 >= n) throw new Error(`reset did not drop planned items (${n2} vs ${n})`);
    await ev((p) => window.__app.importPlan(p), plan);
    eq(await count(), n, 'count after import');
    // dialogs
    await page.click('#btn-plan-menu'); await page.click('#menu-copy');
    const txt = await page.inputValue('#json-out');
    eq(JSON.parse(txt).items.length, n, 'json dialog');
    await page.keyboard.press('Escape');
    await page.click('#btn-plan-menu'); await page.click('#menu-import');
    await page.fill('#json-in', txt); await page.click('#json-apply');
    eq(await count(), n, 'count after pasted import');
    return `${n} items`;
  });
  await step('autosave', async () => {
    await page.waitForTimeout(800);
    const s = await ev(() => JSON.parse(localStorage.getItem('planner.plan.v1')));
    eq(s.version, 1, 'version');
  });
  await step('help dialog', async () => {
    await page.click('#btn-help'); if (!(await page.isVisible('#help-dialog'))) throw new Error('no help');
    await page.keyboard.press('Escape');
  });
  await step('phone size', async () => {
    await page.setViewportSize({ width: 390, height: 780 }); await frames(3);
    await page.click('#btn-more');
    if (!(await page.isVisible('#left'))) await page.click('#btn-catalog');
    await frames(2);
    if (!(await page.isVisible('#left'))) throw new Error('catalogue sheet hidden');
    await page.setViewportSize({ width: size[0], height: size[1] });
  });

  await browser.close(); srv.close();
  console.log(failed ? `\n${failed} step(s) FAILED` : '\nall steps passed');
  process.exit(failed ? 1 : 0);
})();
