#!/usr/bin/env python3
"""Build the hosted copy of the app (a claude.ai Artifact page).

The Artifact host wraps the page in its own <html>/<head>/<body> and only reliably runs inline code, so the
hosted page is a fragment: <title>, the CSS inlined in <style>, the body of index.html, and the whole app
bundled into one inline <script type="module">. Only images are published next to it, under the same
relative paths the app uses (assets/ground/*, assets/photos/*).

  python3 tools/build_artifact.py <out.html> <path/to/esbuild>
      → writes the fragment, prints {"page", "bytes", "files": [...]} (files = images to publish alongside)

esbuild is not a project dependency (the app itself needs no build step); get it with
  npm install --prefix /tmp/esb esbuild   →   /tmp/esb/node_modules/.bin/esbuild
"""
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET_DIRS = ['assets/ground', 'assets/photos']
ASSET_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.svg', '.glb'}


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    out, esbuild = os.path.abspath(sys.argv[1]), sys.argv[2]
    src = read('index.html')
    title = re.search(r'<title>(.*?)</title>', src, re.S).group(1).strip()
    css = '\n'.join(read(href.lstrip('./')) for href in re.findall(r'<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"', src))
    if 'url(' in css:
        print('warning: css contains url(...) — check that the paths still resolve from the page root', file=sys.stderr)
    body = re.search(r'<body[^>]*>(.*)</body>', src, re.S).group(1)
    entry = re.search(r'<script\b[^>]*type="module"[^>]*src="([^"]+)"[^>]*>\s*</script>', body)
    body = body.replace(entry.group(0), '').strip()

    with tempfile.TemporaryDirectory() as tmp:
        bundle_path = os.path.join(tmp, 'app.js')
        subprocess.run([esbuild, entry.group(1).lstrip('./'), '--bundle', '--format=esm', '--minify',
                        '--target=es2020', '--log-level=warning', f'--outfile={bundle_path}'], cwd=ROOT, check=True)
        with open(bundle_path, encoding='utf-8') as f:
            bundle = f.read()
    bundle = bundle.replace('</script', '<\\/script')

    page = (f'<title>{title}</title>\n<style>\n{css}\n</style>\n{body}\n'
            f'<script type="module">\n{bundle}\n</script>\n')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(page)

    files = sorted(
        os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, '/')
        for d in ASSET_DIRS for base, _, names in os.walk(os.path.join(ROOT, d)) for n in names
        if os.path.splitext(n)[1].lower() in ASSET_EXT)
    print(json.dumps({'page': out, 'bytes': len(page.encode('utf-8')),
                      'assets_bytes': sum(os.path.getsize(os.path.join(ROOT, f)) for f in files), 'files': files}))


if __name__ == '__main__':
    main()
