#!/usr/bin/env node
// Screenshot tool (headless Chromium + software WebGL). One browser, many shots.
//
//   node tools/shot.cjs [--size 960x720] [--wait 300] [--port N] <page?query> <out.jpg> [<page?query> <out.jpg> ...]
//
// Examples:
//   node tools/shot.cjs "dev/view.html?photo=IMG_4010" /tmp/a.jpg "dev/view.html?view=top" /tmp/b.jpg
//   node tools/shot.cjs --size 720x960 "dev/view.html?photo=IMG_4009&overlay=0.5" /tmp/c.jpg
//
// It serves the repo root on a free port (or --port N; if N is busy, the server already there is used),
// waits for window.__READY === true, then saves a JPEG. Console errors and page errors are printed.
// Keep screenshots small (default 960x720): they are read by a model, and pixels cost tokens.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon' };

function serve(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    srv.on('error', () => resolve(null));           // port busy → assume a server is already running
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const args = process.argv.slice(2);
  let port = 0, size = [960, 720], wait = 300, full = false;
  const jobs = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--port') port = +args[++i];
    else if (a === '--size') size = args[++i].split('x').map(Number);
    else if (a === '--wait') wait = +args[++i];
    else if (a === '--full') full = true;
    else jobs.push([a, args[++i]]);
  }
  if (!jobs.length || jobs.some((j) => !j[1])) { console.error('usage: shot.cjs [opts] <page?query> <out.jpg> ...'); process.exit(2); }

  const srv = await serve(port);
  if (srv) port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  let failed = false;
  for (const [page_, out] of jobs) {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    page.on('requestfailed', (r) => logs.push(`[404?] ${r.url()}`));
    const url = /^https?:/.test(page_) ? page_ : `http://127.0.0.1:${port}/${page_.replace(/^\//, '')}`;
    const t0 = Date.now();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction('window.__READY === true', null, { timeout: 90000 });
      await page.waitForTimeout(wait);
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      await page.screenshot({ path: out, type: 'jpeg', quality: 78, fullPage: full });
      console.log(`ok  ${out}  (${Date.now() - t0} ms)  ${url}`);
    } catch (e) {
      failed = true;
      console.log(`FAIL ${url}: ${e.message.split('\n')[0]}`);
      try { await page.screenshot({ path: out, type: 'jpeg', quality: 70 }); } catch {}
    }
    const uniq = [...new Set(logs)].filter((l) => !/GPU stall|GL Driver Message/.test(l));
    if (uniq.length) console.log(uniq.slice(0, 12).map((l) => '    ' + l.slice(0, 300)).join('\n'));
    await page.close();
  }
  await browser.close();
  if (srv) srv.close();
  process.exit(failed ? 1 : 0);
})();
