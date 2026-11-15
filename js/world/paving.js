// Paving: old tumbled cobbles (pad, terrace), new light-grey slabs (path, terraceNew), steel edging and concrete kerbs.
import * as THREE from '../lib/three.js';
import { BufferGeometryUtils } from '../lib/addons.js';
import { rng, jitterHex, makeCanvas, canvasTexture, normalMapFromHeight } from '../core/procedural.js';

const PPM = 400;                 // texture pixels per metre
const COBBLE_TILE = 1.28;        // metres per repeat
const SLAB_TILE = 1.2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Rows of stones: row heights / stone widths from `sizes` (cm); the last of each row stretches so the tile repeats. */
function layout(total, sizes, rnd, jitter) {
  const out = [];
  let pos = 0;
  while (pos < total - 1) {
    let s = sizes[Math.floor(rnd() * sizes.length)];
    if (jitter) s *= 1 + (rnd() - 0.5) * jitter;
    if (total - (pos + s) < sizes[0] * 0.8) s = total - pos;
    out.push([pos, s]);
    pos += s;
  }
  return out;
}

function stoneTextures(kind) {
  const rnd = rng(kind === 'cobble' ? 11 : 23);
  const S = kind === 'cobble' ? Math.round(COBBLE_TILE * PPM) : Math.round(SLAB_TILE * PPM);
  const col = makeCanvas(S), hgt = makeCanvas(S), rough = makeCanvas(S);
  const c = col.getContext('2d'), h = hgt.getContext('2d'), r = rough.getContext('2d');
  const joint = kind === 'cobble' ? '#4b473f' : '#9a9a98';
  c.fillStyle = joint; c.fillRect(0, 0, S, S);
  h.fillStyle = '#000'; h.fillRect(0, 0, S, S);
  r.fillStyle = '#fff'; r.fillRect(0, 0, S, S);
  const jw = kind === 'cobble' ? 0.011 * PPM : 0.005 * PPM;        // joint width px
  const palette = kind === 'cobble'
    ? ['#b3ad9d', '#9a9484', '#7d7868', '#a8a291', '#8c8676', '#b9b3a3']
    : ['#c9c9c7', '#c4c4c2', '#cfcfcd', '#bfbfbd'];
  let rows;
  if (kind === 'cobble') rows = layout(S, [0.09 * PPM, 0.12 * PPM, 0.12 * PPM, 0.18 * PPM], rnd, 0.1);
  else rows = layout(S, [0.1 * PPM], rnd, 0);
  rows.forEach(([y0, rh], ri) => {
    const sizes = kind === 'cobble' ? [0.09 * PPM, 0.12 * PPM, 0.12 * PPM, 0.18 * PPM] : [0.2 * PPM];
    const offset = kind === 'slab' ? (ri % 2 ? 0.1 * PPM : 0) : -rnd() * 0.1 * PPM;
    // stones of the row, wrapped around horizontally
    const items = layout(S, sizes, rnd, kind === 'cobble' ? 0.12 : 0);
    items.forEach(([x0, sw]) => {
      const x = x0 + offset;
      const base = jitterHex(rnd.pick(palette), rnd, kind === 'cobble' ? 0.07 : 0.025);
      for (const dx of [-S, 0, S]) {
        const px = x + dx + jw / 2, py = y0 + jw / 2, w = sw - jw, hh = rh - jw;
        if (px > S || px + w < 0) continue;
        const rad = kind === 'cobble' ? Math.min(w, hh) * 0.22 : 2;
        c.fillStyle = base; roundRect(c, px, py, w, hh, rad); c.fill();
        // soft gradient so stones look tumbled
        if (kind === 'cobble') {
          const g = c.createLinearGradient(px, py, px + w * 0.5, py + hh);
          g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
          c.fillStyle = g; roundRect(c, px, py, w, hh, rad); c.fill();
        }
        h.fillStyle = '#fff'; roundRect(h, px, py, w, hh, rad); h.fill();
        r.fillStyle = kind === 'cobble' ? (rnd() < 0.5 ? '#e8e8e8' : '#f4f4f4') : '#d8d8d8';
        roundRect(r, px, py, w, hh, rad); r.fill();
      }
    });
  });
  // speckle
  const img = c.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * (kind === 'cobble' ? 26 : 12);
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  c.putImageData(img, 0, 0);
  const soft = makeCanvas(S);
  const sc = soft.getContext('2d');
  sc.filter = `blur(${kind === 'cobble' ? 2.2 : 1.2}px)`;
  sc.drawImage(hgt, 0, 0);
  sc.drawImage(hgt, -S, 0); sc.drawImage(hgt, S, 0); sc.drawImage(hgt, 0, -S); sc.drawImage(hgt, 0, S);
  return {
    map: canvasTexture(col, { srgb: true, repeat: [1, 1], anisotropy: 8 }),
    normalMap: canvasTexture(normalMapFromHeight(soft, kind === 'cobble' ? 6 : 3), { srgb: false, repeat: [1, 1], anisotropy: 8 }),
    roughnessMap: canvasTexture(rough, { srgb: false, repeat: [1, 1], anisotropy: 4 }),
  };
}

/** Set UVs of a horizontal plane (rotated to lie in XZ) to world metres / tile. swap = long side along Y. */
function paveGeometry(rect, tile, swap) {
  const [X0, Y0, X1, Y1] = rect;
  const g = new THREE.PlaneGeometry(X1 - X0, Y1 - Y0);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) / 2, 0, -(Y0 + Y1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), Y = -p.getZ(i);
    uv.setXY(i, (swap ? Y : X) / tile, (swap ? X : Y) / tile);
  }
  return g;
}

function boxAt(X0, Y0, X1, Y1, h) {
  const g = new THREE.BoxGeometry(X1 - X0, h, Y1 - Y0);
  g.translate((X0 + X1) / 2, h / 2, -(Y0 + Y1) / 2);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

/** Subtract intervals from [a,b]. */
function subtract(a, b, cuts) {
  let segs = [[a, b]];
  for (const [c0, c1] of cuts) {
    segs = segs.flatMap(([s0, s1]) => (c1 <= s0 || c0 >= s1) ? [[s0, s1]] : [[s0, Math.max(s0, c0)], [Math.min(s1, c1), s1]].filter(([x, y]) => y - x > 0.01));
  }
  return segs;
}

export function createPaving({ site, maxAniso }) {
  const group = new THREE.Group();
  group.name = 'paving';
  const meshes = [];

  const mats = {};
  for (const kind of ['cobble', 'slab']) {
    const t = stoneTextures(kind);
    for (const k of Object.values(t)) k.anisotropy = Math.min(8, maxAniso);
    mats[kind] = new THREE.MeshStandardMaterial({
      map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(1, 1), roughnessMap: t.roughnessMap,
      roughness: kind === 'cobble' ? 0.85 : 0.8, metalness: 0,
    });
  }

  const slabs = site.paving.filter((p) => p.kind === 'slab');
  for (const p of site.paving) {
    const tile = p.kind === 'cobble' ? COBBLE_TILE : SLAB_TILE;
    const swap = p.id === 'path';             // path pavers run along Y
    const m = new THREE.Mesh(paveGeometry(p.rect, tile, swap), mats[p.kind]);
    m.position.y = p.id === 'terraceNew' ? 0.03 : 0.02;
    m.receiveShadow = true;
    m.name = 'paving-' + p.id;
    group.add(m);
    meshes.push(m);
  }

  // black steel edging round every cobble rect (except where a slab area abuts)
  const edgeGeoms = [];
  const EW = 0.02, EH = 0.05;
  for (const p of site.paving.filter((q) => q.kind === 'cobble')) {
    const [X0, Y0, X1, Y1] = p.rect;
    const abut = (axis, v) => slabs.filter((s) => s.id !== 'terraceNew' || true).flatMap((s) => {
      const [a0, b0, a1, b1] = s.rect;
      if (axis === 'Y' && (Math.abs(b0 - v) < 0.02 || Math.abs(b1 - v) < 0.02)) return [[a0, a1]];
      if (axis === 'X' && (Math.abs(a0 - v) < 0.02 || Math.abs(a1 - v) < 0.02)) return [[b0, b1]];
      return [];
    });
    for (const [a, b] of subtract(X0, X1, abut('Y', Y0))) edgeGeoms.push(boxAt(a, Y0 - EW / 2, b, Y0 + EW / 2, EH));
    for (const [a, b] of subtract(X0, X1, abut('Y', Y1))) edgeGeoms.push(boxAt(a, Y1 - EW / 2, b, Y1 + EW / 2, EH));
    for (const [a, b] of subtract(Y0, Y1, abut('X', X0))) edgeGeoms.push(boxAt(X0 - EW / 2, a, X0 + EW / 2, b, EH));
    for (const [a, b] of subtract(Y0, Y1, abut('X', X1))) edgeGeoms.push(boxAt(X1 - EW / 2, a, X1 + EW / 2, b, EH));
  }
  if (edgeGeoms.length) {
    const m = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(edgeGeoms),
      new THREE.MeshStandardMaterial({ color: '#26282b', roughness: 0.6, metalness: 0.5 }));
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }

  // dark concrete kerbs, 8 cm wide, on both long sides of the path
  const path = site.paving.find((p) => p.id === 'path');
  if (path) {
    const [X0, Y0, X1, Y1] = path.rect;
    const kerb = [boxAt(X0, Y0, X0 + 0.08, Y1, 0.05), boxAt(X1 - 0.08, Y0, X1, Y1, 0.05)];
    const m = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(kerb),
      new THREE.MeshStandardMaterial({ color: '#55575a', roughness: 0.9 }));
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }

  return { group, meshes };
}
