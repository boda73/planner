// Everything outside the fence: street, neighbour buildings, tree / hedge masses, pole, far tree line, pale skyline blocks.
// Vegetation is rebuilt per season (cheap: a few thousand triangles) so autumn / winter can change the shape, not just the tint.
import * as THREE from '../lib/three.js';
import { BufferGeometryUtils } from '../lib/addons.js';
import { rng, hash2, fbm, makeCanvas, canvasTexture, jitterHex } from '../core/procedural.js';

const col = (hex) => new THREE.Color(hex);
const hsl = (h, s, l) => new THREE.Color().setHSL(h, THREE.MathUtils.clamp(s, 0, 1), THREE.MathUtils.clamp(l, 0, 1), THREE.SRGBColorSpace);

// ---------------------------------------------------------------- tiny non-indexed mesh builder (position / normal / colour)
class Mesher {
  constructor() { this.p = []; this.n = []; this.c = []; }
  push(x, y, z, nx, ny, nz, c) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(c.r, c.g, c.b); }
  /** colour: THREE.Color or (x, y, z) → Color */
  addGeo(g, colour) {
    const ng = g.index ? g.toNonIndexed() : g;
    const P = ng.attributes.position, N = ng.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      this.push(x, y, z, N.getX(i), N.getY(i), N.getZ(i), typeof colour === 'function' ? colour(x, y, z) : colour);
    }
  }
  /** flat triangle, wound so its normal points away from `ref` */
  tri(a, b, c, colour, ref) {
    const ab = new THREE.Vector3().subVectors(b, a), ac = new THREE.Vector3().subVectors(c, a);
    const n = new THREE.Vector3().crossVectors(ab, ac).normalize();
    const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
    if (n.dot(mid.sub(ref)) < 0) { [b, c] = [c, b]; n.negate(); }
    this.push(a.x, a.y, a.z, n.x, n.y, n.z, colour);
    this.push(b.x, b.y, b.z, n.x, n.y, n.z, colour);
    this.push(c.x, c.y, c.z, n.x, n.y, n.z, colour);
  }
  quad(a, b, c, d, colour, ref) { this.tri(a, b, c, colour, ref); this.tri(a, c, d, colour, ref); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}

const ICO = [IcosahedronCache(0), IcosahedronCache(1)];
function IcosahedronCache(detail) { return new THREE.IcosahedronGeometry(1, detail); }

/** Lumpy ellipsoid; colourFn(y01, noise) → Color. Normals are the smooth ellipsoid normals. */
function blob(m, cx, cy, cz, rx, ry, rz, detail, seed, colourFn) {
  const g = ICO[detail], P = g.attributes.position;
  const sx = seed * 7919 | 0;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const h = hash2(Math.round(x * 1000) + sx, Math.round(y * 1000) + Math.round(z * 1000) * 31, seed);
    const s = 1 + (h - 0.5) * 0.4;
    const nx = x / rx, ny = y / ry, nz = z / rz, nl = Math.hypot(nx, ny, nz) || 1;
    m.push(cx + x * rx * s, cy + y * ry * s, cz + z * rz * s, nx / nl, ny / nl, nz / nl, colourFn(y * 0.5 + 0.5, h));
  }
}

// ---------------------------------------------------------------- season palettes
function leaf(season, kind, treeRand, light) {
  let h, s, l;
  switch (season) {
    case 'spring': h = 0.235 + (treeRand - 0.5) * 0.03; s = 0.6; l = 0.27 + 0.2 * light; break;
    case 'autumn': {
      h = treeRand < 0.3 ? 0.14 : treeRand < 0.55 ? 0.11 : treeRand < 0.85 ? 0.19 : 0.085;
      s = 0.46; l = 0.24 + 0.18 * light; break;
    }
    case 'winter': h = 0.08; s = 0.12; l = 0.15 + 0.12 * light; break;
    default:
      h = (kind === 'fruit-old' ? 0.24 : kind === 'poplar' ? 0.285 : 0.265) + (treeRand - 0.5) * 0.04;
      s = 0.42; l = 0.15 + 0.2 * light;
  }
  return hsl(h, s, l);
}
const evergreen = (light) => hsl(0.3, 0.42, 0.12 + 0.12 * light);

// ---------------------------------------------------------------- buildings
function gableRoof(m, cX, cY, sx, sy, wallH, roofH, along, wallCol, roofCol, mono) {
  const L = along === 'X' ? sx : sy, S = along === 'X' ? sy : sx;
  const Lh = L / 2 + 0.25, Sh = S / 2, ov = 0.3;
  const W = (u, v, y) => along === 'X' ? new THREE.Vector3(cX + u, y, -(cY + v)) : new THREE.Vector3(cX + v, y, -(cY + u));
  const ref = new THREE.Vector3(cX, wallH * 0.5, -cY);
  const ridge = wallH + roofH;
  if (mono) {
    const lo = wallH - roofH * ov / S, hi = ridge + roofH * ov / S;
    m.quad(W(-Lh, -Sh - ov, lo), W(Lh, -Sh - ov, lo), W(Lh, Sh + ov, hi), W(-Lh, Sh + ov, hi), roofCol, ref);
    for (const u of [-L / 2, L / 2]) m.tri(W(u, -Sh, wallH), W(u, Sh, wallH), W(u, Sh, ridge), wallCol, ref);
    return;
  }
  const ye = wallH - roofH * ov / Sh;
  for (const sgn of [-1, 1]) m.quad(W(-Lh, sgn * (Sh + ov), ye), W(Lh, sgn * (Sh + ov), ye), W(Lh, 0, ridge), W(-Lh, 0, ridge), roofCol, ref);
  for (const u of [-L / 2, L / 2]) m.tri(W(u, -Sh, wallH), W(u, Sh, wallH), W(u, 0, ridge), wallCol, ref);
}

function buildBuildings(site) {
  const m = new Mesher();
  const rnd = rng(31);
  for (const b of site.context.buildings) {
    const [cX, cY] = b.center, [sx, sy] = b.size;
    const wall = col(b.wall), roof = col(b.roofColor);
    const along = b.ridgeAlong || 'X';
    if (b.open) {
      const post = col('#6b5a48');
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.14, b.wallH, 0.14);
        g.translate(cX + dx * (sx / 2 - 0.1), b.wallH / 2, -(cY + dy * (sy / 2 - 0.1)));
        m.addGeo(g, post);
      }
    } else {
      const g = new THREE.BoxGeometry(sx, b.wallH, sy);
      g.translate(cX, b.wallH / 2, -cY);
      m.addGeo(g, (x, y, z) => wall.clone().multiplyScalar(0.94 + 0.1 * fbm(x * 0.8 + 3, y * 0.8 + z * 0.8, { octaves: 2, seed: 4 })));
    }
    gableRoof(m, cX, cY, sx, sy, b.wallH, b.roofH, along, wall, roof, b.roof === 'mono');
    void rnd;
  }
  for (const p of site.context.poles || []) {
    const g = new THREE.CylinderGeometry(0.1, 0.15, p.h, 8);
    g.translate(p.X, p.h / 2, -p.Y);
    m.addGeo(g, col('#5a4a3a'));
    const arm = new THREE.BoxGeometry(1.6, 0.1, 0.1);
    arm.translate(p.X, p.h - 0.6, -p.Y);
    m.addGeo(arm, col('#4a3b2e'));
  }
  return m.geometry();
}

// ---------------------------------------------------------------- vegetation
function buildTree(m, t, i, season, rnd) {
  const r0 = hash2(i, 3, 17);
  const bare = season === 'winter';
  const kind = t.kind;
  const trunkH = kind === 'poplar' ? t.h * 0.3 : Math.max(1.2, t.h - t.r * 2.0);
  const cyl = new THREE.CylinderGeometry(0.1 + t.r * 0.02, 0.16 + t.r * 0.04, trunkH + 0.8, 7);
  cyl.translate(t.X, (trunkH + 0.8) / 2, -t.Y);
  m.addGeo(cyl, col('#4b3a2c'));
  const k = bare ? 0.55 : season === 'autumn' ? 0.85 : 1;
  const nb = Math.round((kind === 'poplar' ? 6 : 8) * (bare ? 0.7 : 1));
  for (let b = 0; b < nb; b++) {
    let dx, dy, dz, br, ry;
    if (kind === 'poplar') {
      const f = b / (nb - 1);
      dy = trunkH + f * (t.h - trunkH - t.r * 0.9); dx = (rnd() - 0.5) * t.r * 0.3; dz = (rnd() - 0.5) * t.r * 0.3;
      br = t.r * (0.5 - 0.2 * Math.abs(f - 0.4)); ry = br * 1.5;
    } else {
      const cy = t.h - t.r * 1.05;
      const a = rnd() * Math.PI * 2, d = (b === 0 ? 0 : 0.55 + rnd() * 0.35) * t.r * 0.62;
      dx = Math.cos(a) * d; dz = Math.sin(a) * d; dy = cy + (rnd() - 0.4) * t.r * 0.55 + (b === 0 ? t.r * 0.25 : 0);
      br = t.r * (0.5 + rnd() * 0.15); ry = br * 0.85;
    }
    blob(m, t.X + dx, dy, -t.Y + dz, br * k, ry * k, br * k, 1, i * 13 + b,
      (y01, n) => leaf(season, kind, r0, 0.5 * y01 + 0.5 * n));
  }
}

function buildHedge(m, h, i, season, rnd) {
  const [X0, Y0] = h.from, [X1, Y1] = h.to;
  const L = Math.hypot(X1 - X0, Y1 - Y0), ang = Math.atan2(Y1 - Y0, X1 - X0);
  if (h.kind === 'clipped') {
    const g = new THREE.BoxGeometry(L, h.h, h.w, Math.ceil(L / 0.4), 4, 2);
    g.rotateY(ang); g.translate((X0 + X1) / 2, h.h / 2, -(Y0 + Y1) / 2);
    m.addGeo(g, (x, y, z) => evergreen(fbm(x * 2.2, y * 2.2 + z * 2.2, { octaves: 3, seed: 8 })));
    return;
  }
  const bare = season === 'winter';
  const n = Math.ceil(L / 1.1), r0 = hash2(i, 5, 19);
  for (let row = 0; row < 2; row++) {
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      const X = X0 + (X1 - X0) * f + (rnd() - 0.5) * 0.3, Y = Y0 + (Y1 - Y0) * f + (rnd() - 0.5) * 0.3;
      const hh = h.h * (row ? 0.72 : 0.45) * (0.9 + rnd() * 0.2);
      const k = bare ? 0.6 : 1;
      blob(m, X, hh, -Y, h.w * 0.75 * k, h.h * 0.34 * k, h.w * 0.75 * k, 1, i * 101 + j * 3 + row,
        (y01, nn) => leaf(season, 'wild', r0, 0.5 * y01 + 0.5 * nn));
    }
  }
}

export function buildVegetation(site, season) {
  const rnd = rng(1234);
  const near = new Mesher();
  site.context.trees.forEach((t, i) => buildTree(near, t, i, season, rnd));
  site.context.hedges.forEach((h, i) => buildHedge(near, h, i, season, rnd));

  // far tree line around the plot, 60–150 m
  const far = new Mesher();
  const N = 260, bare = season === 'winter';
  const cx = site.plot.width / 2, cy = site.plot.depth / 2;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (rnd() - 0.5) * 0.02;
    const d = 62 + rnd() * rnd() * 95 + (i % 3) * 8;
    const x = cx + Math.sin(a) * d, z = -(cy + Math.cos(a) * d);
    const tall = rnd() < 0.12;
    const h = (tall ? 15 : 8 + rnd() * 6), r = 3.5 + rnd() * 3 * (tall ? 0.5 : 1);
    const r0 = rnd(), k = bare ? 0.6 : 1;
    const f = (y01, n) => leaf(season, tall ? 'poplar' : 'broadleaf', r0, 0.5 * y01 + 0.5 * n);
    const trunk = new THREE.CylinderGeometry(0.25, 0.35, h * 0.5, 5);
    trunk.translate(x, h * 0.25, z);
    far.addGeo(trunk, col('#4b3a2c'));
    blob(far, x, h * 0.45, z, r * k, h * 0.3 * k, r * k, 0, i * 3, f);
    blob(far, x + (rnd() - 0.5) * 2, h * 0.75, z + (rnd() - 0.5) * 2, r * 0.8 * k, h * 0.26 * k, r * 0.8 * k, 0, i * 3 + 1, f);
  }
  return { near: near.geometry(), far: far.geometry() };
}

// ---------------------------------------------------------------- street
function asphaltTex() {
  const S = 256, c = makeCanvas(S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x / 16, y / 16, { octaves: 3, seed: 2, period: 16 }), s = hash2(x, y, 7);
    const v = 118 + (n - 0.5) * 36 + (s - 0.5) * 30 + (s > 0.985 ? 40 : 0);
    const i = (y * S + x) * 4; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 2; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(40,40,42,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 90); g.bezierCurveTo(80, 70, 150, 110, 256, 85); g.stroke();
  return canvasTexture(c, { srgb: true, repeat: [1 / 4, 1 / 4], anisotropy: 8 });
}
function slabTex() {
  const S = 256, c = makeCanvas(S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm(x / 20, y / 20, { octaves: 3, seed: 6, period: 12.8 }), s = hash2(x, y, 3);
    const v = 190 + (n - 0.5) * 30 + (s - 0.5) * 14;
    const i = (y * S + x) * 4; img.data[i] = v; img.data[i + 1] = v - 2; img.data[i + 2] = v - 7; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(80,78,72,0.7)';
  g.fillRect(0, 0, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(0, S / 2 - 1, S, 3); g.fillRect(S / 2 - 1, 0, 3, S);
  return canvasTexture(c, { srgb: true, repeat: [1 / 2, 1 / 2], anisotropy: 8 });
}

function worldUVBox(g, tile) {
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i));
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (ny > 0.5) UV.setXY(i, x / tile, z / tile);
    else if (nx > 0.5) UV.setXY(i, z / tile, y / tile);
    else UV.setXY(i, x / tile, y / tile);
  }
  return g;
}

function buildStreet(site) {
  const r = site.context.road, group = new THREE.Group();
  const X0 = -160, X1 = 180, W = X1 - X0, cx = (X0 + X1) / 2;
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.95 });
  const concrete = new THREE.MeshStandardMaterial({ map: slabTex(), roughness: 0.9 });
  concrete.map.repeat.set(1, 1);                       // uv already in tile units
  asphalt.map.repeat.set(1, 1);
  const pavH = 0.1, pw = 1.4, kerb = 0.15;
  const concGeoms = [];
  const box = (Ya, Yb, h) => {
    const g = new THREE.BoxGeometry(W, h, Yb - Ya);
    g.translate(cx, h / 2, -(Ya + Yb) / 2);
    return worldUVBox(g, 2);
  };
  concGeoms.push(box(r.Y0, r.Y0 + pw, pavH));                            // near pavement
  concGeoms.push(box(r.Y0 + pw, r.Y0 + pw + kerb, pavH + 0.02));          // kerb (a touch higher)
  concGeoms.push(box(r.Y1 - 0.0, r.Y1 + pw, pavH));                       // far pavement
  const conc = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(concGeoms), concrete);
  conc.receiveShadow = true; group.add(conc);

  const a0 = r.Y0 + pw + kerb, a1 = r.Y1;
  const ag = new THREE.PlaneGeometry(W, a1 - a0);
  ag.rotateX(-Math.PI / 2); ag.translate(cx, 0.004, -(a0 + a1) / 2);
  const uv = ag.attributes.uv, pos = ag.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 4, -pos.getZ(i) / 4);
  const road = new THREE.Mesh(ag, asphalt);
  road.receiveShadow = true; group.add(road);
  return group;
}

// ---------------------------------------------------------------- skyline
function facadeTex() {
  const W = 64, H = 64, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#d9dad6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#8c98a4';
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) g.fillRect(4 + x * 20, 8 + y * 28, 13, 16);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, W, 4);
  return canvasTexture(c, { srgb: true, repeat: [1, 1], anisotropy: 4 });
}

function buildSkyline(site) {
  const sl = site.context.skyline;
  const tex = facadeTex(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: 0xf2f2f0 });
  const geoms = [];
  const cx = site.plot.width / 2, cy = site.plot.depth / 2;
  const rnd = rng(55);
  sl.blocksBearing.forEach((b, i) => {
    for (let k = 0; k < 2; k++) {
      const bearing = b + (k ? 3.2 : 0) + (rnd() - 0.5) * 2, d = sl.distance + k * 18 + (rnd() - 0.5) * 10;
      const w = 46 - k * 8 + rnd() * 8, h = 30 + rnd() * 12 - k * 5, dep = 16;
      const a = THREE.MathUtils.degToRad(bearing);
      const g = new THREE.BoxGeometry(w, h, dep);
      const P = g.attributes.position, UV = g.attributes.uv, N = g.attributes.normal;
      for (let v = 0; v < UV.count; v++) {
        const side = Math.abs(N.getX(v)) > 0.5 ? dep : w;
        UV.setXY(v, UV.getX(v) * side / 3.4, UV.getY(v) * h / 3.2);
      }
      void P;
      g.rotateY(-a);
      g.translate(cx + Math.sin(a) * d, h / 2 - 0.5, -(cy + Math.cos(a) * d));
      geoms.push(g);
    }
    void i;
  });
  return new THREE.Mesh(BufferGeometryUtils.mergeGeometries(geoms), mat);
}

// ---------------------------------------------------------------- entry
export function createSurroundings({ site }) {
  const group = new THREE.Group();
  group.name = 'surroundings';

  group.add(buildStreet(site));

  const bm = new THREE.Mesh(buildBuildings(site), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  bm.castShadow = bm.receiveShadow = true;
  group.add(bm);

  const vegMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const near = new THREE.Mesh(new THREE.BufferGeometry(), vegMat);
  near.receiveShadow = true;   // no cast: neighbours' trees would blot the lawn more than the real photos show
  const far = new THREE.Mesh(new THREE.BufferGeometry(), vegMat);
  group.add(near, far);

  const sky = buildSkyline(site);
  group.add(sky);

  function setSeason(season) {
    const v = buildVegetation(site, season);
    near.geometry.dispose(); far.geometry.dispose();
    near.geometry = v.near; far.geometry = v.far;
  }
  setSeason('summer');
  void jitterHex;
  return { group, setSeason };
}
