// Low-level geometry builders for plants: one Buf per material, filled by tube / blob / card / cone helpers,
// all with per-vertex colours. Everything is built in plain arrays and turned into one BufferGeometry per Buf.
import * as THREE from '../lib/three.js';
import { valueNoise } from '../core/procedural.js';

// ---------------------------------------------------------------- colours (linear RGB triplets)
const _c = new THREE.Color();
/** '#rrggbb' (sRGB) → [r,g,b] linear. */
export function lin(hex) { _c.set(hex); return [_c.r, _c.g, _c.b]; }
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** 3D-ish value noise in [-1, 1] built from two 2D lookups (procedural.js has 2D only). */
export function noise3(x, y, z, seed = 0) {
  return valueNoise(x + z * 0.71, y - z * 0.37, seed) + valueNoise(y * 0.93 + 17.3, z + x * 0.29, seed + 7) - 1;
}

// ---------------------------------------------------------------- buffer
export class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; }
  get nv() { return this.p.length / 3; }
  get ntri() { return this.i.length / 3; }
  v(x, y, z, nx, ny, nz, col, u = 0, w = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); this.u.push(u, w);
    return this.nv - 1;
  }
  t(a, b, c) { this.i.push(a, b, c); }
  q(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  geometry() {
    if (!this.i.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.nv > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export { V };

// ---------------------------------------------------------------- tube along a polyline (wood)
const _t = V(), _n = V(), _b = V(), _d = V();
/**
 * pts: Vector3[], radii: number[] (same length), sides ≥ 3, col: [r,g,b] or (i, s) → [r,g,b].
 */
export function tube(buf, pts, radii, sides, col) {
  const n = pts.length, base = buf.nv;
  let prevN = null;
  for (let i = 0; i < n; i++) {
    if (i === 0) _t.subVectors(pts[1], pts[0]); else if (i === n - 1) _t.subVectors(pts[i], pts[i - 1]);
    else _t.subVectors(pts[i + 1], pts[i - 1]);
    _t.normalize();
    if (!prevN) { prevN = Math.abs(_t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0); }
    _n.copy(prevN).addScaledVector(_t, -prevN.dot(_t)).normalize();
    prevN.copy(_n);
    _b.crossVectors(_t, _n);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      _d.set(_n.x * ca + _b.x * sa, _n.y * ca + _b.y * sa, _n.z * ca + _b.z * sa);
      const r = radii[i], p = pts[i];
      buf.v(p.x + _d.x * r, p.y + _d.y * r, p.z + _d.z * r, _d.x, _d.y, _d.z, typeof col === 'function' ? col(i, s, p) : col);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const s1 = (s + 1) % sides;
      buf.q(base + i * sides + s, base + i * sides + s1, base + (i + 1) * sides + s1, base + (i + 1) * sides + s);
    }
  }
}

// ---------------------------------------------------------------- blobs (deformed low-poly ellipsoids)
const TPL = {};
function template(kind) {
  if (TPL[kind]) return TPL[kind];
  let g = kind === 'ico1' ? new THREE.IcosahedronGeometry(1, 1) : kind === 'oct1' ? new THREE.OctahedronGeometry(1, 1)
    : kind === 'oct0' ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0);
  const pos = g.attributes.position.array, map = new Map(), verts = [], idx = [];
  for (let i = 0; i < pos.length / 3; i++) {
    const key = `${pos[i * 3].toFixed(4)},${pos[i * 3 + 1].toFixed(4)},${pos[i * 3 + 2].toFixed(4)}`;
    let k = map.get(key);
    if (k === undefined) { k = verts.length / 3; map.set(key, k); verts.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
    idx.push(k);
  }
  g.dispose();
  return (TPL[kind] = { verts, idx });
}

/**
 * Deformed ellipsoid. o = { kind:'ico1'|'ico0'|'oct1'|'oct0', amp, freq, seed, center: Vector3 for normal blending,
 * blend (0..1 how much normals point away from `center`), shade(x,y,z,nx,ny,nz) → [r,g,b] }
 */
export function blob(buf, cx, cy, cz, rx, ry, rz, o) {
  const { verts, idx } = template(o.kind || 'ico1');
  const base = buf.nv, amp = o.amp ?? 0.22, f = o.freq ?? 1.7, seed = o.seed ?? 0, bl = o.blend ?? 0.45, C = o.center;
  for (let i = 0; i < verts.length; i += 3) {
    const ux = verts[i], uy = verts[i + 1], uz = verts[i + 2];
    const d = 1 + amp * noise3(ux * f + seed * 3.1, uy * f, uz * f, seed);
    const x = cx + ux * rx * d, y = cy + uy * ry * d, z = cz + uz * rz * d;
    let nx = ux / rx, ny = uy / ry, nz = uz / rz;
    let l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    if (C) {
      let ex = x - C.x, ey = y - C.y, ez = z - C.z;
      l = Math.hypot(ex, ey, ez) || 1;
      nx = nx * (1 - bl) + (ex / l) * bl; ny = ny * (1 - bl) + (ey / l) * bl; nz = nz * (1 - bl) + (ez / l) * bl;
      l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    }
    buf.v(x, y, z, nx, ny, nz, o.shade(x, y, z, nx, ny, nz));
  }
  for (let i = 0; i < idx.length; i++) buf.i.push(base + idx[i]);
}

// ---------------------------------------------------------------- alpha-tested cards
// Atlas quadrants (see materials.js): 0 broadleaf tuft, 1 thuja scale spray, 2 needles, 3 blossom.
const _up = V(), _r = V();
/**
 * Quad centred at p facing n (unit), with its 'up' edge towards `up` (projected on the plane).
 * Normals of all four vertices = nn (default n): pass the crown's outward normal for soft lighting.
 */
export function card(buf, p, n, up, w, h, quad, col, mirror = false, nn = n, col2 = col) {
  _up.copy(up).addScaledVector(n, -up.dot(n));
  if (_up.lengthSq() < 1e-6) _up.set(1, 0, 0).addScaledVector(n, -n.x);
  _up.normalize();
  _r.crossVectors(_up, n);
  const u0 = (quad % 2) * 0.5 + 0.004, v0 = (quad >> 1) * 0.5 + 0.004, us = 0.492;
  const ua = mirror ? u0 + us : u0, ub = mirror ? u0 : u0 + us;
  const hw = w / 2, hh = h / 2, base = buf.nv;
  const P = (sx, sy) => [p.x + _r.x * sx * hw + _up.x * sy * hh, p.y + _r.y * sx * hw + _up.y * sy * hh, p.z + _r.z * sx * hw + _up.z * sy * hh];
  let a = P(-1, -1); buf.v(a[0], a[1], a[2], nn.x, nn.y, nn.z, col2, ua, 1 - (v0 + us));
  a = P(1, -1); buf.v(a[0], a[1], a[2], nn.x, nn.y, nn.z, col2, ub, 1 - (v0 + us));
  a = P(1, 1); buf.v(a[0], a[1], a[2], nn.x, nn.y, nn.z, col, ub, 1 - v0);
  a = P(-1, 1); buf.v(a[0], a[1], a[2], nn.x, nn.y, nn.z, col, ua, 1 - v0);
  buf.q(base, base + 1, base + 2, base + 3);
}

// ---------------------------------------------------------------- small solids for accents
/** Cone / panicle: base ring of `sides` at p, apex at p + dir·len. */
export function cone(buf, p, dir, radius, len, sides, col, colTip = col) {
  _t.copy(dir).normalize();
  const nrm = Math.abs(_t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  _n.copy(nrm).addScaledVector(_t, -nrm.dot(_t)).normalize();
  _b.crossVectors(_t, _n);
  const base = buf.nv;
  for (let s = 0; s < sides; s++) {
    const a = (s / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    _d.set(_n.x * ca + _b.x * sa, _n.y * ca + _b.y * sa, _n.z * ca + _b.z * sa);
    buf.v(p.x + _d.x * radius, p.y + _d.y * radius, p.z + _d.z * radius, _d.x * 0.8 + _t.x * 0.4, _d.y * 0.8 + _t.y * 0.4, _d.z * 0.8 + _t.z * 0.4, col);
  }
  const apex = buf.v(p.x + _t.x * len, p.y + _t.y * len, p.z + _t.z * len, _t.x, _t.y, _t.z, colTip);
  const bot = buf.v(p.x - _t.x * len * 0.08, p.y - _t.y * len * 0.08, p.z - _t.z * len * 0.08, -_t.x, -_t.y, -_t.z, col);
  for (let s = 0; s < sides; s++) {
    const s1 = (s + 1) % sides;
    buf.t(base + s, base + s1, apex);
    buf.t(base + s1, base + s, bot);
  }
}

/** Ribbon (leaf blade / grass): centre-line points + widths, side vector per point; double-sided material. */
export function ribbon(buf, pts, widths, side, colBase, colTip) {
  const n = pts.length, base = buf.nv;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), p = pts[i], w = widths[i] / 2;
    _t.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
    _n.crossVectors(side, _t).normalize();
    if (_n.y < 0) _n.negate();
    const col = mix3(colBase, colTip, t);
    buf.v(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w, _n.x, _n.y, _n.z, col);
    buf.v(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w, _n.x, _n.y, _n.z, col);
  }
  for (let i = 0; i < n - 1; i++) buf.q(base + i * 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
}
