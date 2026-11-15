#!/usr/bin/env python3
"""Prepare the hosted (claude.ai Artifact) copy of the app.

The Artifact host wraps the page in its own <html>/<head>/<body>, so the page file must be a fragment:
<title>, stylesheet links and the body contents of index.html. Everything else is published next to it
under the same relative paths.

  python3 tools/build_artifact.py <out.html>      # writes the fragment, prints the supporting-file list as JSON
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHIP = ['css', 'js', 'vendor/three/build', 'vendor/three/examples', 'assets/ground', 'assets/photos']
EXT = {'.js', '.css', '.jpg', '.jpeg', '.png', '.webp', '.svg', '.json', '.glb'}


def main():
    out = sys.argv[1]
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    title = re.search(r'<title>(.*?)</title>', src, re.S).group(1).strip()
    links = re.findall(r'<link\b[^>]*rel="stylesheet"[^>]*>', src)
    body = re.search(r'<body[^>]*>(.*)</body>', src, re.S).group(1).strip()
    page = '\n'.join([f'<title>{title}</title>', *links, body]) + '\n'
    page = re.sub(r'(href|src)="\./', r'\1="', page)        # published paths are relative without "./"
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(page)

    files = []
    for top in SHIP:
        for base, _, names in os.walk(os.path.join(ROOT, top)):
            for n in sorted(names):
                if os.path.splitext(n)[1].lower() in EXT:
                    files.append(os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, '/'))
    files.sort()
    total = sum(os.path.getsize(os.path.join(ROOT, f)) for f in files)
    print(json.dumps({'page': out, 'count': len(files), 'bytes': total, 'files': files}, ensure_ascii=False))


if __name__ == '__main__':
    main()
