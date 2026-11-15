// Fences along the plot boundary: net, chainlink, welded panel, wood, wire mesh. Fill = double-sided alpha-tested plane.
import * as THREE from '../lib/three.js';
import { BufferGeometryUtils } from '../lib/addons.js';
import { rng, jitterHex, makeCanvas, canvasTexture } from '../core/procedural.js';

const TYPES = {
  // tile = [metres along, metres up] covered by one texture repeat; post = [size, colour]
  net:       { colour: '#2f3d33', tile: [0.25, 0.25], post: [0.05, '#1c1d1f'], rough: 1.0, shadow: true, a2c: true },
  chainlink: { colour: '#6b5a48', tile: [0.4, 0.4], post: [0.09, '#a9a69d'], rough: 0.8, shadow: false, a2c: true, rail: true },
  panel:     { colour: '#4a4d50', tile: [0.2, 0.2], post: [0.06, '#3a3d40'], rough: 0.6, shadow: false, a2c: true },
  wood:      { colour: '#ffffff', tile: [1.2, 1.5], post: [0.09, '#59402e'], rough: 0.9, shadow: true, a2c: false },
  mesh:      { colour: '#c3c7c7', tile: [0.2, 0.2], post: [0.045, '#2f4a35'], rough: 0.5, shadow: false, a2c: true, rail: true },
};

function alphaTexture(type) {
  const t = TYPES[type];
  const S = type === 'chainlink' ? 256 : (type === 'net' ? 128 : 256);
  const c = makeCanvas(S), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  if (type === 'net') {
    // knitted shade net: ~85 % solid with tiny holes
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#000';
    for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) g.fillRect(x + ((y / 8) % 2) * 4, y, 2, 3);
  } else if (type === 'chainlink') {
    g.lineWidth = 5; const P = 32;
    for (let k = -S; k <= 2 * S; k += P) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke();
      g.beginPath(); g.moveTo(k, S); g.lineTo(k + S, 0); g.stroke();
    }
  } else if (type === 'panel') {
    g.lineWidth = 5;
    const w = S / (t.tile[0] / 0.2);
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, i * S / 4 + 2); g.lineTo(S, i * S / 4 + 2); g.stroke(); }
    g.beginPath(); g.moveTo(2, 0); g.lineTo(2, S); g.stroke();
    void w;
  } else if (type === 'mesh') {
    g.lineWidth = 3.2; const P = 64;
    for (let i = 0; i < S / P; i++) {
      g.beginPath(); g.moveTo(0, i * P + 1.6); g.lineTo(S, i * P + 1.6); g.stroke();
      g.beginPath(); g.moveTo(i * P + 1.6, 0); g.lineTo(i * P + 1.6, S); g.stroke();
    }
  }
  return canvasTexture(c, { srgb: false, repeat: [1 / t.tile[0], 1 / t.tile[1]], anisotropy: 8 });
}

function woodTexture() {
  const rnd = rng(77);
  const W = 480, H = 600, B = 48;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#1e140e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < W / B; i++) {
    const base = jitterHex('#6b4a35', rnd, 0.14);
    g.fillStyle = base; g.fillRect(i * B + 2, 0, B - 4, H);
    for (let k = 0; k < 14; k++) {                       // grain streaks
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '30,18,10' : '150,110,80'},${0.12 + rnd() * 0.12})`;
      g.lineWidth = 1 + rnd() * 1.5;
      const x = i * B + 4 + rnd() * (B - 8);
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rnd() * 6 - 3, H * 0.3, x + rnd() * 6 - 3, H * 0.6, x + rnd() * 4 - 2, H); g.stroke();
    }
  }
  return canvasTexture(c, { srgb: true, repeat: [1 / TYPES.wood.tile[0], 1 / TYPES.wood.tile[1]], anisotropy: 8 });
}

function fillGeometry(from, to, h) {
  // quad in world space: plot (X,Y) → (x, z = −Y); uv in metres
  const [X0, Y0] = from, [X1, Y1] = to;
  const L = Math.hypot(X1 - X0, Y1 - Y0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([X0, 0, -Y0, X1, 0, -Y1, X1, h, -Y1, X0, h, -Y0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, L, 0, L, h, 0, h], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

export function createFences({ site }) {
  const group = new THREE.Group();
  group.name = 'fences';
  const colliders = [];
  const postGeoms = [];
  const mats = {};

  for (const f of site.fences) {
    const t = TYPES[f.type];
    if (!mats[f.type]) {
      if (f.type === 'wood') {
        mats[f.type] = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: t.rough, side: THREE.DoubleSide });
      } else {
        mats[f.type] = new THREE.MeshStandardMaterial({
          color: t.colour, roughness: t.rough, metalness: f.type === 'mesh' ? 0.6 : 0.2, side: THREE.DoubleSide,
          alphaMap: alphaTexture(f.type),
          // see-through wire fences blend (mip-averaged coverage looks right at any distance); the net is alpha-tested
          ...(f.type === 'net' ? { alphaTest: 0.5, alphaToCoverage: true } : { transparent: true, depthWrite: false }),
        });
      }
    }
    const fill = new THREE.Mesh(fillGeometry(f.from, f.to, f.h), mats[f.type]);
    fill.castShadow = t.shadow; fill.receiveShadow = true;
    fill.name = 'fence-' + f.id;
    group.add(fill);

    // posts every ≤ 2.5 m, evenly spaced, both ends included
    const [X0, Y0] = f.from, [X1, Y1] = f.to;
    const L = Math.hypot(X1 - X0, Y1 - Y0);
    const n = Math.ceil(L / 2.5);
    const ps = t.post[0], col = new THREE.Color(t.post[1]);
    for (let i = 0; i <= n; i++) {
      const X = X0 + (X1 - X0) * i / n, Y = Y0 + (Y1 - Y0) * i / n;
      const g = new THREE.BoxGeometry(ps, f.h + 0.08, ps);
      g.translate(X, (f.h + 0.08) / 2, -Y);
      postGeoms.push(tint(g, col));
    }
    if (t.rail) {                      // top rail
      const dx = X1 - X0, dy = Y1 - Y0;
      const g = new THREE.BoxGeometry(L, 0.03, 0.03);
      g.rotateY(Math.atan2(dy, dx));
      g.translate((X0 + X1) / 2, f.h, -(Y0 + Y1) / 2);
      postGeoms.push(tint(g, col));
    }
    const pad = 0.06;
    colliders.push({
      type: 'box', minX: Math.min(X0, X1) - pad, maxX: Math.max(X0, X1) + pad,
      minY: Math.min(Y0, Y1) - pad, maxY: Math.max(Y0, Y1) + pad, h: f.h,
    });
  }

  const posts = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(postGeoms),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }));
  posts.receiveShadow = true;
  group.add(posts);
  return { group, colliders };
}

function tint(geom, color) {
  geom.deleteAttribute('uv');
  const g = geom.toNonIndexed();
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
