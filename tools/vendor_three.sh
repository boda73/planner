#!/usr/bin/env bash
# Re-vendor three.js (no CDN, no build step): the minified ES-module build + the addons listed below,
# with their  from 'three'  imports rewritten to the vendored build. Usage: tools/vendor_three.sh [version]
set -euo pipefail
cd "$(dirname "$0")/.."
ver="${1:-0.170.0}"
addons=(controls/OrbitControls.js geometries/RoundedBoxGeometry.js math/ImprovedNoise.js math/SimplexNoise.js
        objects/Sky.js utils/BufferGeometryUtils.js)
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
(cd "$tmp" && npm pack --silent "three@$ver" >/dev/null && tar -xzf three-*.tgz)
mkdir -p vendor/three/build
cp "$tmp/package/LICENSE" vendor/three/LICENSE
cp "$tmp/package/build/three.module.min.js" vendor/three/build/
for f in "${addons[@]}"; do
  mkdir -p "vendor/three/examples/jsm/$(dirname "$f")"
  sed "s#from 'three'#from '../../../build/three.module.min.js'#" "$tmp/package/examples/jsm/$f" > "vendor/three/examples/jsm/$f"
done
echo "vendored three@$ver: build + ${#addons[@]} addons"
