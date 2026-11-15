// Archetype builders. Each takes a build context X and fills X.wood / X.fol / X.cards / X.acc (Bufs).
//   X = { def, g, H, W, age, trunkR, look, r (rng), wood, fol, cards, acc }
//   look = { season, leaf (0..1 foliage amount), autumn (0..1 autumn colour mix), fresh (0..1 spring tint),
//            flowering, fruiting, bloomColor, late (0..1 late-bloom tint) }
import { Buf, V, lin, mix3, mul3, noise3, tube, blob, card, cone, ribbon } from './mesh.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const UP = V(0, 1, 0);

// ---------------------------------------------------------------- palettes / shading
/** Leaf palette for the current look: {dark, mid, light} linear colours. */
function leafPalette(X, hex = X.g.leaf, k = 0) {
  const { look, r } = X;
  let base = lin(hex);
  if (look.fresh > 0) base = mix3(base, mix3(mul3(base, 1.25), lin('#a8c850'), 0.35), look.fresh);
  if (look.autumn > 0 && X.def.autumnColor) base = mix3(base, lin(X.def.autumnColor), clamp(look.autumn * (0.55 + 0.6 * (k || r())), 0, 1));
  if (look.season === 'winter' && X.def.evergreen && X.g.form !== 'herb') base = mix3(base, lin('#6a6a40'), 0.12);
  return { dark: mix3(mul3(base, 0.3), lin('#1a2410'), 0.3), mid: mul3(base, 0.72), light: mix3(mul3(base, 1.08), lin('#d8e070'), 0.06) };
}
function bloomPalette(hex) {
  const c = lin(hex);
  return { dark: mix3(mul3(c, 0.55), lin('#4a5a30'), 0.25), mid: mul3(c, 0.85), light: c };
}
const ramp = (P, k) => (k < 0.5 ? mix3(P.dark, P.mid, k * 2) : mix3(P.mid, P.light, (k - 0.5) * 2));
const jit = (c, r, a = 0.08) => { const k = 1 + (r() * 2 - 1) * a; return [c[0] * k, c[1] * k * (1 + (r() - 0.5) * a * 0.6), c[2] * k]; };

/** Shader-like colour function for foliage inside an ellipsoidal crown (cy, R, Ry). */
function crownShade(X, cy, R, Ry, getPal) {
  const { r, H } = X;
  return (x, y, z, nx, ny) => {
    const out = Math.sqrt((x * x + z * z) / (R * R) + ((y - cy) * (y - cy)) / (Ry * Ry));
    const k = clamp(0.02 + 0.5 * out + 0.22 * ny + 0.16 * (y / H), 0, 1);
    return jit(ramp(getPal(), k), r, 0.07);
  };
}

function randUnit(r) {
  const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return V(s * Math.cos(a), u, s * Math.sin(a));
}

/** Distance along unit dir d from p to the ellipsoid (centre (0,cy,0), radii R,Ry,R); 0 if p is outside. */
function toEnvelope(p, d, cy, R, Ry) {
  const px = p.x / R, py = (p.y - cy) / Ry, pz = p.z / R, dx = d.x / R, dy = d.y / Ry, dz = d.z / R;
  const a = dx * dx + dy * dy + dz * dz, b = 2 * (px * dx + py * dy + pz * dz), c = px * px + py * py + pz * pz - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  return Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
}

function path(p0, dir, L, n, bend, droop, r, wob = 0.06) {
  const pts = [p0.clone()];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push(V(p0.x + dir.x * L * t + (r() - 0.5) * wob * L, p0.y + dir.y * L * t + bend * L * t * t - droop * L * Math.pow(t, 2.2),
      p0.z + dir.z * L * t + (r() - 0.5) * wob * L));
  }
  return pts;
}
const radii = (n, r0, r1) => Array.from({ length: n }, (_, i) => r0 + (r1 - r0) * (i / (n - 1)));
const along = (pts, t) => {
  const f = t * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2), u = f - i;
  return pts[i].clone().lerp(pts[i + 1], u);
};
function dirFrom(az, elev) { return V(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az)); }

/** Leaf / blossom cards scattered on a blob surface. */
function blobCards(X, c, rx, ry, rz, n, size, quad, palFn, outC, upBias = 0.4) {
  const { r } = X;
  for (let i = 0; i < n; i++) {
    const d = randUnit(r);
    const o = V(c.x - outC.x, c.y - outC.y, c.z - outC.z).normalize();
    if (d.dot(o) < -0.25) d.addScaledVector(o, 1.2).normalize();
    d.y += upBias * 0.3; d.normalize();
    const e = 0.92 + r() * 0.2;
    const p = V(c.x + d.x * rx * e, c.y + d.y * ry * e, c.z + d.z * rz * e);
    const n0 = d.clone().addScaledVector(o, 0.5).normalize();
    const face = n0.clone().add(randUnit(r).multiplyScalar(0.55)).normalize();
    const up = V(r() - 0.5, 1.2, r() - 0.5).addScaledVector(d, 0.6);
    const s = size * (0.75 + r() * 0.5);
    const col = palFn(p, n0);
    card(X.cards, p, face, up, s, s, quad, col, r() < 0.5, n0, mul3(col, 0.72));
  }
}

// ---------------------------------------------------------------- broadleaf / pine tree
const CROWN = {
  round: { elev: [35, 55], leader: true, spread: 0.25, blobR: 0.32, flat: 0.85, bend: 0.12 },
  oval: { elev: [55, 72], leader: true, spread: 0.45, blobR: 0.3, flat: 0.95, bend: 0.08 },
  spreading: { elev: [18, 35], leader: false, spread: 0.15, blobR: 0.34, flat: 0.65, bend: 0.1 },
  vase: { elev: [48, 62], leader: false, spread: 0.08, blobR: 0.3, flat: 0.8, bend: 0.1 },
  weeping: { elev: [55, 70], leader: true, spread: 0.5, blobR: 0.24, flat: 1.25, bend: 0.0, droop: 0.55 },
  pine: { elev: [0, 25], leader: true, spread: 0.85, blobR: 0.3, flat: 0.45, bend: 0.15 },
};

export function buildTree(X) {
  const { g, H, W, r, look } = X;
  const C = { ...CROWN[g.crown || 'round'] };
  const yb = clamp((g.crownBase ?? 0.3) * H, 0.25, H * 0.7);
  const R = W / 2, Ry = (H - yb) / 2, cy = yb + Ry;
  const tr = X.trunkR, small = H < 2.2;
  const bark = lin(g.bark || '#5a4a40'), barkDark = lin(g.barkDark || '#2a2420'), barkTop = g.barkTop ? lin(g.barkTop) : null;
  const barkCol = (i, s, p) => {
    let c = bark;
    if (barkTop) c = mix3(bark, barkTop, ss(H * 0.35, H * 0.65, p.y));
    if (g.barkDark) {
      const n = noise3(p.x * 9, p.y * 6, p.z * 9, 3);
      c = mix3(c, barkDark, p.y < 0.6 ? 0.6 : n > 0.45 ? 0.8 : 0);
    }
    return jit(c, r, 0.06);
  };
  // trunk + leader
  const lean = V(r.range(-0.05, 0.05), 0, r.range(-0.05, 0.05));
  const tpts = [];
  const tTop = C.leader ? H * (g.crown === 'pine' ? 0.97 : 0.8) : yb;
  const nT = C.leader ? 6 : 3;
  for (let i = 0; i <= nT; i++) {
    const y = (tTop * i) / nT;
    tpts.push(V(lean.x * y + (i ? (r() - 0.5) * 0.04 * H / 4 : 0), y, lean.z * y + (i ? (r() - 0.5) * 0.04 * H / 4 : 0)));
  }
  const axisAt = (y) => along(tpts, clamp(y / tTop, 0, 1));
  const trR = tpts.map((p, i) => {
    const t = p.y / Math.max(tTop, 0.01);
    return C.leader ? tr * (1.15 - 1.05 * Math.pow(t, 0.8)) + 0.004 : tr * (1.15 - 0.3 * t);
  });
  tube(X.wood, tpts, trR, small ? 5 : 7, barkCol);

  // main branches
  const nMain = small ? Math.max(3, g.branches[0] - 1) : r.int(g.branches[0], g.branches[1]);
  const az0 = r() * Math.PI * 2;
  const tips = [];       // [{p, dir}] foliage anchors
  const twigs = [];
  for (let i = 0; i < nMain; i++) {
    const az = az0 + (i / nMain) * Math.PI * 2 + r.range(-0.35, 0.35);
    const elev = (r.range(C.elev[0], C.elev[1]) * Math.PI) / 180;
    const y0 = yb + (C.leader ? r() * C.spread * (H - yb) * (g.crown === 'pine' ? 1 : 1) : r() * 0.06 * H);
    const p0 = axisAt(Math.min(y0, tTop * 0.98));
    const d = dirFrom(az, elev);
    const L = Math.max(0.2, toEnvelope(p0, d, cy, R, Ry) * (g.crown === 'pine' ? 0.75 : 0.82));
    const pts = path(p0, d, L, 3, C.bend, C.droop ? C.droop * 0.4 : 0, r);
    const rb0 = tr * r.range(0.45, 0.62);
    tube(X.wood, pts, radii(4, rb0, rb0 * 0.25), small ? 4 : 5, barkCol);
    tips.push({ p: pts[3], dir: d });
    // secondaries
    const nSec = small ? 1 : r.int(2, 3);
    for (let k = 0; k < nSec; k++) {
      const f = r.range(0.35, 0.8);
      const q0 = along(pts, f);
      const daz = az + r.sign() * r.range(0.4, 0.9);
      const de = elev + r.range(-0.25, 0.35);
      const d2 = dirFrom(daz, clamp(de, -0.2, 1.4));
      const L2 = Math.max(0.15, toEnvelope(q0, d2, cy, R, Ry) * 0.78);
      const p2 = path(q0, d2, L2, 2, C.bend * 0.5, C.droop || 0, r);
      tube(X.wood, p2, radii(3, rb0 * (1 - f * 0.6) * 0.6, rb0 * 0.08), small ? 3 : 4, barkCol);
      tips.push({ p: p2[2], dir: d2 });
      if (!small) tips.push({ p: along(p2, 0.45).lerp(along(pts, 1), 0.3), dir: d2 });
      twigs.push(p2);
    }
  }
  if (C.leader && g.crown !== 'vase') tips.push({ p: tpts[tpts.length - 1].clone(), dir: UP.clone() });

  // twigs (denser when bare so winter trees read as twiggy, not as sticks)
  const bare = look.leaf < 0.35 && !look.flowering;
  const twN = bare ? 4 : 1;
  for (const p2 of twigs) {
    for (let k = 0; k < twN; k++) {
      const a = along(p2, r.range(0.4, 1));
      const d = randUnit(r); d.y = Math.abs(d.y) * 0.8 + 0.3; d.normalize();
      const L = R * r.range(0.12, 0.25);
      tube(X.wood, [a, a.clone().addScaledVector(d, L)], [Math.max(0.004, tr * 0.06), 0.002], 3, barkCol);
    }
  }

  // foliage clusters
  const blobR = (g.blobR ?? C.blobR) * ((R + Ry) / 2) * 1.25;
  const flat = g.flat ?? C.flat;
  const anchors = tips.slice();
  if (C.leader && !small) {
    for (let y = yb + Ry * 0.4; y < H - Ry * 0.3; y += Ry * 0.45) {
      const p = axisAt(Math.min(y, tTop)), a = r() * 6.28;
      anchors.push({ p: V(p.x + Math.cos(a) * R * 0.45, y, p.z + Math.sin(a) * R * 0.45), dir: V(Math.cos(a), 0.3, Math.sin(a)) });
    }
  }
  for (let i = 0; i < (small ? 1 : 3); i++) {
    const d = randUnit(r); d.y = Math.abs(d.y);
    anchors.push({ p: V(d.x * R * 0.35, cy + d.y * Ry * 0.4, d.z * R * 0.35), dir: d });
  }
  while (anchors.length > 24) anchors.splice(Math.floor(r() * anchors.length), 1);
  const crownC = V(0, cy, 0);
  let pal = null;
  const shade = crownShade(X, cy, R, Ry, () => pal);
  const blossomFrac = look.flowering ? (g.blossomFrac ?? (X.def.category === 'tree-fruit' ? 0.8 : 0)) : 0;
  const blossomCards = look.flowering ? (g.blossomCards ?? (blossomFrac > 0 ? 1 : 0.3)) : 0;
  const bloomPal = look.flowering ? bloomPalette(X.def.bloom.color) : null;
  const kept = [];
  const cardSize = clamp(0.3 + 0.06 * H, 0.3, 0.75) * (g.cardScale ?? 1);
  const tex = g.tex ?? 0;
  for (const a of anchors) {
    const isBloom = r() < blossomFrac;
    if (!isBloom && r() >= look.leaf) continue;
    const sz = blobR * r.range(0.75, 1.15) * (isBloom ? 0.85 : 0.7 + 0.3 * look.leaf);
    let rx = sz, ry = sz * flat, rz = sz * r.range(0.85, 1.1);
    let c = a.p.clone();
    if (C.droop) { ry = sz * 1.3; rx *= 0.75; rz *= 0.75; c.y -= sz * 0.5; }
    if (g.crown === 'pine') c.addScaledVector(a.dir, sz * 0.3);
    // keep the cluster inside the crown envelope
    const e = Math.sqrt((c.x * c.x + c.z * c.z) / (R * R) + ((c.y - cy) ** 2) / (Ry * Ry));
    const lim = Math.max(0.3, 1 - sz / Math.max(R, Ry) * 0.6);
    if (e > lim) { const k = lim / e; c = V(c.x * k, cy + (c.y - cy) * k, c.z * k); }
    pal = isBloom ? bloomPal : leafPalette(X);
    const P = pal;
    blob(X.fol, c.x, c.y, c.z, rx, ry, rz, { kind: 'ico1', amp: 0.34, freq: 2.1, seed: r.int(0, 999), center: crownC, blend: 0.5, shade: (x, y, z, a, b, cc) => mul3(shade(x, y, z, a, b, cc), 0.72) });
    const nC = Math.round(clamp(sz * 16, 6, 16) * (0.5 + 0.5 * look.leaf));
    blobCards(X, c, rx, ry, rz, nC, cardSize, tex, (p, n) => { pal = P; return mul3(shade(p.x, p.y, p.z, n.x, n.y, n.z), 1.45); }, crownC);
    if (blossomCards > 0) {
      const nb = Math.round(nC * blossomCards);
      blobCards(X, c, rx * 1.02, ry * 1.02, rz * 1.02, nb, cardSize * 0.9, 3, () => jit(bloomPal.light, r, 0.05), crownC);
    }
    if (!isBloom) kept.push({ c, rx, ry, rz });
  }
  // fruit
  if (look.fruiting && kept.length) {
    const n = Math.round((g.fruitCount || 40) * clamp((W / X.def.matureWidth) ** 2, 0.15, 1.2));
    fruitOn(X, kept, n, crownC);
  }
}

function fruitOn(X, blobs, n, crownC) {
  const { g, r } = X;
  const size = g.fruitSize || g.berry || 0.02;
  const fc = lin(X.def.fruitColor || '#b01818');
  const cl = g.fruitCluster || 1;
  for (let i = 0; i < n; i += cl) {
    const b = blobs[Math.floor(r() * blobs.length)];
    const d = randUnit(r); d.y = d.y * 0.6 - 0.25;
    const o = V(b.c.x - crownC.x, 0, b.c.z - crownC.z);
    if (o.lengthSq() > 0.01 && d.dot(o) < 0) { d.x = -d.x; d.z = -d.z; }
    d.normalize();
    const p = V(b.c.x + d.x * b.rx * 0.92, b.c.y + d.y * b.ry * 0.92, b.c.z + d.z * b.rz * 0.92);
    for (let k = 0; k < cl; k++) {
      const q = k ? p.clone().add(randUnit(r).multiplyScalar(size * 1.6)) : p;
      let col = jit(fc, r, 0.12);
      if (g.fruitShape !== 'pear' && X.def.id === 'apple' && r() < 0.35) col = mix3(col, lin('#c8c040'), 0.6);
      const kind = size < 0.026 ? 'oct0' : 'ico0';
      const s = size * r.range(0.85, 1.15);
      blob(X.acc, q.x, q.y, q.z, s, s * (g.fruitShape === 'pear' ? 1.35 : 0.95), s, { kind, amp: 0, shade: (x, y) => (y > q.y + s * 0.3 ? mul3(col, 1.25) : col) });
    }
  }
}

// ---------------------------------------------------------------- column / cone / globe conifer (thuja, juniper)
const PROFILE = {
  column: (t) => (0.8 + 0.2 * ss(0, 0.18, t)) * Math.pow(Math.max(0, 1 - t ** 3), 0.62),
  narrow: (t) => (0.85 + 0.15 * ss(0, 0.12, t)) * Math.pow(Math.max(0, 1 - t ** 2.2), 0.7),
  cone: (t) => Math.pow(Math.max(0, 1 - t), 0.95) * (0.88 + 0.12 * ss(0, 0.08, t)),
  globe: (t) => { const u = 0.08 + 0.92 * t; return Math.sqrt(Math.max(0, 1 - ((u - 0.5) / 0.5) ** 2)) * 1.0; },
};

export function buildConifer(X) {
  const { g, H, W, r } = X;
  const prof = PROFILE[g.profile] || PROFILE.column;
  const bump = g.bump ?? 0.12;
  const pal = leafPalette(X);
  const inner = lin(g.inner || '#22361a'), mid = mix3(lin(g.mid || g.leaf), pal.mid, 0.3), outer = pal.light;
  const seed = r.int(0, 999);
  const fx = 1 / 0.2, fy = 1 / 0.42;
  const rad = (t, th) => {
    const r0 = prof(t) * W / 2;
    const n = noise3(Math.cos(th) * 1.3 * fx * 0.25 + Math.cos(th) * r0 * fx, t * H * fy, Math.sin(th) * r0 * fx, seed);
    return { r: r0 * (1 + bump * n * 2.2), n };
  };
  const Rn = clamp(Math.round(H / 0.16), 6, 18), S = W < 0.45 ? 8 : 14;
  const base = X.fol.nv;
  for (let i = 0; i <= Rn; i++) {
    const t = i / Rn, y = t * H;
    const dr = (prof(Math.min(1, t + 0.02)) - prof(Math.max(0, t - 0.02))) / 0.04 * (W / 2) / H;
    for (let s = 0; s < S; s++) {
      const th = (s / S) * Math.PI * 2;
      const { r: rr, n } = rad(t, th);
      const nx = Math.cos(th), nz = Math.sin(th), ny = -dr;
      const l = Math.hypot(nx, ny, nz);
      const k = clamp(0.2 + 0.3 * n + 0.1 * t, 0, 1);
      X.fol.v(nx * rr, y, nz * rr, nx / l, ny / l, nz / l, jit(mix3(inner, mid, k), r, 0.05));
    }
  }
  for (let i = 0; i < Rn; i++) for (let s = 0; s < S; s++) {
    const s1 = (s + 1) % S;
    X.fol.q(base + i * S + s, base + (i + 1) * S + s, base + (i + 1) * S + s1, base + i * S + s1);
  }
  // bottom cap
  const bc = X.fol.v(0, 0.02, 0, 0, -1, 0, inner);
  for (let s = 0; s < S; s++) X.fol.t(base + s, base + ((s + 1) % S), bc);

  // cards: scale sprays / needle shoots over the surface, sticking out a little to break the silhouette
  let area = 0;
  for (let i = 0; i < 20; i++) area += 2 * Math.PI * prof((i + 0.5) / 20) * (W / 2) * (H / 20);
  const cs = clamp(0.1 + 0.09 * Math.min(H, W * 3), 0.1, 0.38) * (g.cardScale ?? 1);
  const nCards = Math.round(clamp((area / (cs * cs)) * 5.5, 20, X.small ? 110 : 420));
  const tex = g.tex ?? 1;
  // stratified placement: area-weighted CDF in t, golden-angle steps in θ → even coverage, no bald patches
  const NB = 40, cdf = [0];
  for (let i = 0; i < NB; i++) cdf.push(cdf[i] + prof((i + 0.5) / NB) + 0.02);
  const invCdf = (u) => {
    const v = u * cdf[NB];
    let i = 0; while (i < NB - 1 && cdf[i + 1] < v) i++;
    return Math.min(0.985, (i + (v - cdf[i]) / (cdf[i + 1] - cdf[i])) / NB);
  };
  const th0 = r() * 6.28;
  for (let i = 0; i < nCards; i++) {
    const t = invCdf((i + 0.2 + r() * 0.6) / nCards);
    const th = th0 + i * 2.39996 + r.range(-0.25, 0.25);
    const { r: rr, n } = rad(t, th);
    const dr = (prof(Math.min(1, t + 0.02)) - prof(Math.max(0, t - 0.02))) / 0.04 * (W / 2) / H;
    const o = V(Math.cos(th), -dr, Math.sin(th)).normalize();
    const depth = r.range(0.86, 1.04);
    const p = V(o.x * 0 + Math.cos(th) * rr * depth, t * H + cs * 0.15, Math.sin(th) * rr * depth);
    const face = o.clone().add(randUnit(r).multiplyScalar(0.7)).normalize();
    const up = V(Math.cos(th) * 0.35, 1, Math.sin(th) * 0.35);
    const w = cs * r.range(0.8, 1.2);
    const k = clamp(0.25 + 0.35 * (n * 0.5 + 0.5) + 0.25 * t + (depth - 0.9) * 2.2, 0, 1);
    const col = jit(mix3(mid, outer, k), r, 0.08);
    card(X.cards, p, face, up, w, w * 1.3, tex, col, r() < 0.5, o, mix3(col, inner, 0.45));
  }
}

// ---------------------------------------------------------------- tiered spruce
export function buildSpruce(X) {
  const { g, H, W, r } = X;
  const pal = leafPalette(X);
  const inner = lin(g.inner || '#22361a'), mid = mix3(lin(g.mid || g.leaf), pal.mid, 0.3);
  tube(X.wood, [V(0, 0, 0), V(0, H * 0.5, 0), V(0, H * 0.95, 0)], [Math.max(0.01, W * 0.035), W * 0.02, 0.004], 5, lin(g.bark || '#4a3a30'));
  const nT = clamp(Math.round(H / 0.3), 4, 22), S = 10;
  const cs = clamp(0.12 + 0.05 * H, 0.15, 0.5);
  for (let k = 0; k < nT; k++) {
    const t = 0.04 + ((k + 0.5) / nT) * 0.9;
    const y = t * H, rr = (W / 2) * Math.pow(1 - t, 0.95) * r.range(0.92, 1.08) + 0.03;
    const droop = rr * 0.5, rise = (H / nT) * 1.1;
    const base = X.fol.nv, a0 = r() * 6;
    X.fol.v(0, y + rise, 0, 0, 1, 0, inner);
    for (let s = 0; s < S; s++) {
      const th = a0 + (s / S) * Math.PI * 2;
      const jag = 1 + (s % 2 ? -0.3 : 0.15) * r.range(0.5, 1.3);
      const cx = Math.cos(th), cz = Math.sin(th);
      X.fol.v(cx * rr * 0.5, y + rise * 0.25, cz * rr * 0.5, cx * 0.4, 0.9, cz * 0.4, jit(mix3(inner, mid, 0.5), r, 0.05));
      X.fol.v(cx * rr * jag, y - droop * jag * r.range(0.7, 1.2), cz * rr * jag, cx * 0.7, 0.7, cz * 0.7, jit(mul3(mid, 0.8), r, 0.1));
    }
    for (let s = 0; s < S; s++) {
      const s1 = (s + 1) % S, m0 = base + 1 + s * 2, m1 = base + 1 + s1 * 2;
      X.fol.t(base, m1, m0);
      X.fol.q(m0, m1, m1 + 1, m0 + 1);
    }
    for (let s = 0; s < S * 2; s++) {
      const th = a0 + ((s + r()) / (S * 2)) * Math.PI * 2, e = r.range(0.55, 1.0);
      const o = V(Math.cos(th), 0.5, Math.sin(th)).normalize();
      const p = V(Math.cos(th) * rr * e, y - droop * e * 0.8 + rise * (1 - e) * 0.3, Math.sin(th) * rr * e);
      const col = jit(mix3(mid, pal.light, r.range(0.3, 0.9)), r, 0.06);
      card(X.cards, p, V(o.x * 0.6 + r.range(-0.3, 0.3), 1, o.z * 0.6 + r.range(-0.3, 0.3)).normalize(), V(Math.cos(th), -0.4, Math.sin(th)), cs * 1.6, cs * 1.2, g.tex ?? 2, col, r() < 0.5, o, mul3(col, 0.65));
    }
  }
  cone(X.fol, V(0, H * 0.9, 0), UP, W * 0.04 + 0.02, H * 0.1, 5, mid, pal.light);
}

// ---------------------------------------------------------------- multi-stem shrub (also rose)
const HABIT = { dome: [0.25, 0.65], upright: [0.05, 0.35], arching: [0.35, 0.75], mound: [0.6, 1.15], ball: [0.2, 0.9] };

export function buildShrub(X) {
  const { def, g, H, W, r, look } = X;
  const habit = g.habit || 'dome';
  const cy = H * 0.5, R = W / 2, Ry = H / 2;
  const nStem = Math.max(2, Math.round(r.range(g.stems[0], g.stems[1]) * clamp(W / def.matureWidth, 0.45, 1)));
  const barkC = lin(g.bark || '#6a5440');
  const sr = 0.004 + 0.008 * Math.sqrt(H);
  const ends = [];
  for (let i = 0; i < nStem; i++) {
    const az = (i / nStem) * Math.PI * 2 + r.range(-0.4, 0.4);
    const tilt = r.range(HABIT[habit][0], HABIT[habit][1]);
    const b = V(Math.cos(az) * W * 0.06 * r(), 0, Math.sin(az) * W * 0.06 * r());
    const d = V(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
    const L = Math.max(0.1, toEnvelope(b, d, cy, R, Ry) * (habit === 'arching' ? 1.05 : 0.85));
    const pts = path(b, d, L, 3, habit === 'arching' ? 0.05 : 0.05, habit === 'arching' ? 0.45 : 0, r, 0.08);
    tube(X.wood, pts, radii(4, sr, sr * 0.3), H < 0.8 ? 3 : 4, jit(barkC, r, 0.06));
    ends.push(pts);
  }
  const bare = look.leaf < 0.35;
  if (bare && !look.flowering) {
    for (const pts of ends) for (let k = 0; k < 2; k++) {
      const a = along(pts, r.range(0.4, 0.9)), d = randUnit(r); d.y = Math.abs(d.y) + 0.3; d.normalize();
      tube(X.wood, [a, a.clone().addScaledVector(d, W * 0.15)], [sr * 0.4, 0.0015], 3, barkC);
    }
  }
  const crownC = V(0, cy * 0.8, 0);
  let pal = null;
  const shade = crownShade(X, cy, R, Ry, () => pal);
  const cs = clamp(0.1 + 0.14 * Math.min(W, H), 0.08, 0.36) * (g.small ? 0.7 : 1);
  const tex = g.tex ?? 0;
  const bloomPal = look.flowering ? bloomPalette(look.bloomColor) : null;
  // bloom on bare wood (forsythia in March–April): blossom cards along the stems only
  if (look.flowering && g.bloomBare && look.leaf < 0.7) {
    for (const pts of ends) for (let k = 0; k < 5; k++) {
      const p = along(pts, r.range(0.25, 1));
      const n = randUnit(r);
      card(X.cards, p, n, V(0, 1, 0), cs * 0.9, cs * 0.9, 3, jit(bloomPal.light, r, 0.06), r() < 0.5, n.clone().setY(Math.abs(n.y)), bloomPal.mid);
    }
    if (look.leaf < 0.35) return;
  }
  if (bare) return;
  // foliage blobs: one per stem tip (+ mid-stem for big shrubs) + a filling core
  const blobs = [];
  const nb = Math.min(ends.length, H > 1.2 ? 6 : 5);
  const rb = ((W + H) / 2) * 0.27 * (g.blobs ?? 1);
  const flat = g.flat ?? (habit === 'ball' ? 1 : 0.85);
  for (let i = 0; i < nb; i++) {
    const pts = ends[i];
    let c = along(pts, habit === 'arching' ? 0.7 : 0.82);
    c.y = Math.min(c.y, H - rb * flat * 0.8);
    blobs.push({ c, rx: rb * r.range(0.85, 1.15), ry: rb * flat * r.range(0.85, 1.1), rz: rb * r.range(0.85, 1.15) });
  }
  blobs.push({ c: V(0, H * 0.45, 0), rx: R * 0.7, ry: Math.min(H * 0.42, R * 0.7 * flat * 1.2), rz: R * 0.7 });
  const amount = look.leaf;
  const kept = [];
  for (const b of blobs) {
    if (r() > amount + 0.15) continue;
    b.rx *= 0.75 + 0.25 * amount; b.ry *= 0.75 + 0.25 * amount; b.rz *= 0.75 + 0.25 * amount;
    pal = leafPalette(X); const P = pal;
    blob(X.fol, b.c.x, b.c.y, b.c.z, b.rx, b.ry, b.rz, { kind: 'oct1', amp: 0.3, freq: 2.2, seed: r.int(0, 999), center: crownC, blend: 0.5, shade });
    const nC = Math.round((g.small ? 9 : 7) * (0.5 + 0.5 * amount));
    blobCards(X, b.c, b.rx, b.ry, b.rz, nC, cs, tex, (p, n) => { pal = P; return mul3(shade(p.x, p.y, p.z, n.x, n.y, n.z), 1.45); }, crownC);
    kept.push(b);
  }
  // flowers
  if (look.flowering && kept.length) {
    const f = g.flower || (def.id === 'rose_bush' ? 'rose' : 'spray');
    const fsize = (g.flowerSize ?? 0.08) * clamp(Math.sqrt(W / def.matureWidth), 0.6, 1);
    let fc = lin(look.bloomColor);
    if (look.late > 0 && g.lateColor) fc = mix3(fc, lin(g.lateColor), look.late);
    if (f === 'spray') {
      for (const b of kept) blobCards(X, b.c, b.rx * 1.03, b.ry * 1.03, b.rz * 1.03, 5, cs * 0.85, 3, () => jit(fc, r, 0.05), crownC, 1);
    } else {
      const n = f === 'rose' ? Math.round(clamp(W * 12, 3, 12)) : Math.round(clamp(W * 6, 3, 14));
      for (let i = 0; i < n; i++) {
        const b = kept[i % kept.length];
        const d = randUnit(r); d.y = Math.abs(d.y) * 0.8 + 0.35; d.normalize();
        const p = V(b.c.x + d.x * b.rx * 0.95, b.c.y + d.y * b.ry * 0.95, b.c.z + d.z * b.rz * 0.95);
        const col = jit(f === 'rose' && g.colors ? lin(g.colors[X.variant % g.colors.length]) : fc, r, 0.07);
        if (f === 'panicle') cone(X.acc, p, d.clone().add(V(0, 1.5, 0)), fsize * 0.5, fsize * 1.7, 6, mul3(col, 0.85), col);
        else {
          const s = f === 'rose' ? 0.04 : fsize * 0.5;
          blob(X.acc, p.x, p.y, p.z, s, s * 0.8, s, { kind: 'ico0', amp: 0.15, seed: i, shade: (x, y) => (y > p.y ? col : mul3(col, 0.7)) });
        }
      }
    }
  }
  if (look.fruiting && kept.length && g.berry) {
    const n = Math.round((g.berryCount || 30) * clamp((W / def.matureWidth) ** 2, 0.2, 1));
    X.g = { ...g, fruitSize: g.berry, fruitCluster: 3 };
    fruitOn(X, kept, n, crownC);
    X.g = g;
  }
}

// ---------------------------------------------------------------- herbaceous: blades, leaf mound, spikes
function blade(X, ang, tilt, len, width, shape, curve, colB, colT, x0 = 0, z0 = 0) {
  const n = shape === 'sword' ? 2 : 3, pts = [], ws = [];
  let p = V(x0, 0.01, z0), a = tilt;
  const dx = Math.cos(ang), dz = Math.sin(ang);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(p.clone());
    ws.push(shape === 'broad' ? (t < 0.3 ? width * 0.1 : width * Math.pow(Math.sin(Math.PI * (t - 0.3) / 0.7), 0.7) + 0.002)
      : shape === 'sword' ? width * (1 - Math.pow(t, 1.6)) + 0.001 : width * (1 - t * t) + 0.0008);
    a += curve / n;
    const st = len / n;
    p = p.clone().add(V(Math.sin(a) * dx * st, Math.cos(a) * st, Math.sin(a) * dz * st));
  }
  ribbon(X.fol, pts, ws, V(-dz, 0, dx), colB, colT);
}

function dormant(X) {
  const { r, W } = X;
  const soil = lin('#4a3a2c');
  cone(X.wood, V(0, 0, 0), UP, W * 0.35, 0.04, 8, soil, mul3(soil, 1.2));
  for (let i = 0; i < 5; i++) {
    const a = r() * 6.28, d = r() * W * 0.2;
    tube(X.wood, [V(Math.cos(a) * d, 0, Math.sin(a) * d), V(Math.cos(a) * d * 1.3, 0.08 + r() * 0.06, Math.sin(a) * d * 1.3)], [0.005, 0.003], 3, lin('#8a7050'));
  }
}

export function buildHerb(X) {
  const { def, g, H, W, r, look } = X;
  if (def.herbaceous && look.leaf < 0.2) return dormant(X);
  const pal = leafPalette(X);
  let colB = mul3(pal.mid, 0.6), colT = g.tip ? mix3(pal.light, leafPalette(X, g.tip).light, 0.6) : pal.light;
  if (look.season === 'winter' && def.winterColor) { colB = mul3(lin(def.winterColor), 0.7); colT = lin(def.winterColor); }
  const sz = clamp(W / def.matureWidth, 0.3, 1.2);
  if (g.blades) {
    const b = g.blades;
    const n = Math.max(5, Math.round(b.n * clamp(sz, 0.4, 1) * (def.herbaceous ? 0.6 + 0.4 * look.leaf : 1)));
    for (let i = 0; i < n; i++) {
      const tilt = r.range(b.tilt[0], b.tilt[1]);
      const len = H * b.len * r.range(0.7, 1.05) / Math.max(0.45, Math.cos(tilt * 0.6));
      blade(X, r() * Math.PI * 2, tilt, len, b.width * clamp(sz, 0.5, 1), b.shape, b.curve * r.range(0.6, 1.3), jit(colB, r, 0.08), jit(colT, r, 0.08),
        r.range(-0.05, 0.05) * W, r.range(-0.05, 0.05) * W);
    }
  }
  if (g.mound) {
    const crownC = V(0, 0, 0);
    let P = pal;
    const shade = crownShade(X, H * 0.35, W / 2, H * 0.6, () => P);
    blob(X.fol, 0, H * 0.4, 0, W * 0.35, H * 0.4, W * 0.35, { kind: 'ico0', amp: 0.2, seed: 1, center: crownC, shade: (x, y, z, a, b, c) => mul3(shade(x, y, z, a, b, c), 0.75) });
    const nl = Math.round(g.mound.leaves * clamp(sz, 0.5, 1));
    for (let i = 0; i < nl; i++) {
      const d = randUnit(r); d.y = Math.abs(d.y) * 0.9 + 0.1; d.normalize();
      const p = V(d.x * W * 0.42, H * 0.1 + d.y * H * 0.75, d.z * W * 0.42);
      const col = jit(mul3(shade(p.x, p.y, p.z, d.x, d.y, d.z), 1.1), r, 0.06);
      const cw = W * (g.mound.size ?? 0.32);
      card(X.cards, p, d.clone().add(randUnit(r).multiplyScalar(0.5)).normalize(), V(d.x, 1, d.z), cw, cw, g.mound.tex ?? 0, mul3(col, 1.25), r() < 0.5, d, mul3(col, 0.75));
    }
  }
  if (!look.flowering) return;
  const fc = lin(look.bloomColor);
  if (g.spike && H > 0.3) {                         // yucca: one tall panicle of white bells
    const hs = g.spike.h * clamp(H / def.matureHeight, 0.5, 1);
    const top = V(r.range(-0.03, 0.03), hs, r.range(-0.03, 0.03));
    tube(X.wood, [V(0, 0.2, 0), V(top.x * 0.5, hs * 0.6, top.z * 0.5), top], [0.014, 0.011, 0.004], 4, lin('#6a7a48'));
    for (let i = 0; i < 16; i++) {
      const t = r.range(0.62, 1);
      const p = V(top.x * t + r.range(-0.09, 0.09) * (1.1 - t), hs * t, top.z * t + r.range(-0.09, 0.09) * (1.1 - t));
      blob(X.acc, p.x, p.y, p.z, 0.024, 0.03, 0.024, { kind: 'oct0', amp: 0, shade: (x, y) => (y < p.y ? mul3(fc, 0.8) : fc) });
    }
  }
  if (g.spikes) {                                   // lavender: thin stalks with violet tips
    const n = Math.round(g.spikes.n * clamp(sz, 0.3, 1));
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = r() * W * 0.42;
      const top = V(Math.cos(a) * d, H * r.range(0.85, 1.0), Math.sin(a) * d);
      ribbon(X.fol, [V(top.x * 0.3, H * 0.3, top.z * 0.3), top], [0.004, 0.003], V(-Math.sin(a), 0, Math.cos(a)), colB, colT);
      card(X.cards, top.clone().add(V(0, 0.05, 0)), V(-Math.sin(a), 0, Math.cos(a)), UP, 0.035, 0.12, 3, jit(fc, r, 0.08), r() < 0.5, V(0, 1, 0));
    }
  }
  if (g.stalks) {                                   // hosta: leaning stalks with lilac bells
    for (let i = 0; i < g.stalks.n; i++) {
      const a = r() * 6.28, top = V(Math.cos(a) * W * 0.12, H * 1.5, Math.sin(a) * W * 0.12);
      ribbon(X.fol, [V(0, 0.05, 0), top], [0.006, 0.004], V(-Math.sin(a), 0, Math.cos(a)), colB, colB);
      card(X.cards, top.clone().add(V(0, -H * 0.15, 0)), V(-Math.sin(a), 0, Math.cos(a)), UP, 0.07, H * 0.35, 3, jit(fc, r, 0.05), false, V(0, 1, 0));
    }
  }
  if (g.heads) {                                    // peony: big balls on top of the mound
    const n = Math.round(g.heads.n * clamp(sz, 0.3, 1));
    for (let i = 0; i < n; i++) {
      const d = randUnit(r); d.y = Math.abs(d.y) * 0.5 + 0.6; d.normalize();
      const p = V(d.x * W * 0.38, H * 0.15 + d.y * H * 0.8, d.z * W * 0.38), s = g.heads.size;
      const col = jit(fc, r, 0.06);
      blob(X.acc, p.x, p.y, p.z, s, s * 0.8, s, { kind: 'ico0', amp: 0.18, seed: i, shade: (x, y) => (y > p.y ? col : mul3(col, 0.75)) });
    }
  }
  if (g.plumes) {                                   // miscanthus: feathery plumes above the leaves
    const n = Math.round(g.plumes.n * clamp(sz, 0.3, 1));
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, top = V(Math.cos(a) * W * 0.15, H * r.range(1.0, 1.15), Math.sin(a) * W * 0.15);
      ribbon(X.fol, [V(0, 0.1, 0), top], [0.005, 0.004], V(-Math.sin(a), 0, Math.cos(a)), colB, colT);
      card(X.cards, top, V(-Math.sin(a), 0, Math.cos(a)), V(top.x, 1, top.z), 0.12, 0.3, 2, jit(fc, r, 0.06), r() < 0.5, V(0, 1, 0));
    }
  }
}

// ---------------------------------------------------------------- raspberry canes
export function buildCane(X) {
  const { def, g, H, W, r, look } = X;
  const n = Math.round(clamp(10 * W / def.matureWidth, 4, 12));
  const barkC = lin(g.bark || '#8a6a4a');
  const pal = leafPalette(X);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const b = V(r.range(-W * 0.4, W * 0.4), 0, r.range(-0.12, 0.12));
    const d = V(b.x * 0.3 + r.range(-0.15, 0.15), 1, r.range(-0.2, 0.2)).normalize();
    const pts = path(b, d, H * r.range(0.8, 1.0), 3, 0, 0.25, r, 0.05);
    tube(X.wood, pts, [0.007, 0.006, 0.004, 0.002], 3, jit(barkC, r, 0.08));
    if (look.leaf < 0.35) continue;
    for (let k = 0; k < 6; k++) {
      const p = along(pts, r.range(0.3, 1)), o = V(p.x - b.x * 0.5, 0, p.z).add(randUnit(r)).normalize();
      const col = jit(ramp(pal, clamp(0.3 + p.y / H * 0.6, 0, 1)), r, 0.07);
      card(X.cards, p, o.clone().add(V(0, 0.5, 0)).normalize(), UP, 0.22, 0.22, 0, col, r() < 0.5, o, mul3(col, 0.7));
    }
    blobs.push({ c: along(pts, 0.7), rx: 0.08, ry: 0.12, rz: 0.08 });
  }
  if (look.leaf >= 0.35) {
    let P = pal;
    const shade = crownShade(X, H * 0.6, W / 2, H / 2, () => P);
    blob(X.fol, 0, H * 0.6, 0, W * 0.4, H * 0.3, 0.15, { kind: 'oct1', amp: 0.3, seed: 2, center: V(0, H * 0.5, 0), shade });
  }
  if (look.fruiting && blobs.length) {
    X.g = { ...g, fruitSize: g.berry, fruitCluster: 1 };
    fruitOn(X, blobs, g.berryCount || 30, V(0, H * 0.5, 0));
    X.g = g;
  }
}

// ---------------------------------------------------------------- ground patches (strawberry bed, pumpkin)
export function buildPatch(X) {
  const { def, g, H, W, r, look } = X;
  const soil = lin('#4e3c2c');
  if (g.style === 'strawberry') {
    const w = W / 2, h = 0.08, s = jit(soil, r, 0.05);
    const P = [[-w, -w], [w, -w], [w, w], [-w, w]];
    const b = X.wood.nv;
    for (const [x, z] of P) X.wood.v(x, h, z, 0, 1, 0, s);
    X.wood.q(b + 3, b + 2, b + 1, b);
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 4], nx = (z1 - z0) / W, nz = -(x1 - x0) / W, k = X.wood.nv;
      X.wood.v(x0, 0, z0, nx, 0, nz, mul3(s, 0.7)); X.wood.v(x1, 0, z1, nx, 0, nz, mul3(s, 0.7));
      X.wood.v(x1, h, z1, nx, 0, nz, s); X.wood.v(x0, h, z0, nx, 0, nz, s);
      X.wood.q(k + 1, k, k + 3, k + 2);
    }
    const pal = leafPalette(X);
    const m = Math.max(2, Math.round(W / 0.3));
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
      const c = V(-w + (i + 0.5) * W / m + r.range(-0.03, 0.03), h, -w + (j + 0.5) * W / m + r.range(-0.03, 0.03));
      const leaves = look.season === 'winter' ? 3 : 5;
      for (let k = 0; k < leaves; k++) {
        const a = (k / leaves) * 6.28 + r(), o = V(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize();
        let col = jit(ramp(pal, r.range(0.4, 0.95)), r, 0.08);
        if (look.season === 'winter') col = mix3(col, lin('#7a3a2a'), 0.4);
        card(X.cards, c.clone().add(V(Math.cos(a) * 0.06, (H - h) * 0.6, Math.sin(a) * 0.06)), o, V(Math.cos(a), 0.3, Math.sin(a)), 0.16, 0.16, 0, col, r() < 0.5, o, mul3(col, 0.7));
      }
      if (look.flowering) card(X.cards, c.clone().add(V(0, H * 0.75, 0)), UP, V(1, 0, 0), 0.08, 0.08, 3, lin('#f8f8f0'), false, UP);
      if (look.fruiting) for (let k = 0; k < 2; k++) {
        const a = r() * 6.28, p = c.clone().add(V(Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1)), fc = jit(lin(def.fruitColor), r, 0.1);
        blob(X.acc, p.x, p.y, p.z, 0.014, 0.018, 0.014, { kind: 'oct0', amp: 0, shade: () => fc });
      }
    }
    return;
  }
  // pumpkin: an annual — bare mound outside May–October
  cone(X.wood, V(0, 0, 0), UP, 0.45, 0.12, 8, soil, mul3(soil, 1.15));
  if (look.leaf < 0.35 || look.season === 'winter') return;
  const pal = leafPalette(X);
  const runners = 4;
  for (let i = 0; i < runners; i++) {
    const a = (i / runners) * 6.28 + r(), L = W * 0.45;
    const pts = [V(0, 0.1, 0), V(Math.cos(a) * L * 0.4, 0.06, Math.sin(a) * L * 0.4), V(Math.cos(a + 0.3) * L, 0.04, Math.sin(a + 0.3) * L)];
    tube(X.wood, pts, [0.012, 0.01, 0.006], 3, lin('#6a8a40'));
    for (let k = 0; k < 7; k++) {
      const p = along(pts, r.range(0, 1)).add(V(r.range(-0.15, 0.15), H * r.range(0.4, 0.9), r.range(-0.15, 0.15)));
      const o = V(r.range(-0.4, 0.4), 1, r.range(-0.4, 0.4)).normalize();
      const col = jit(ramp(pal, r.range(0.35, 0.9)), r, 0.08);
      card(X.cards, p, o, V(Math.cos(a), 0, Math.sin(a)), 0.34, 0.34, 0, col, r() < 0.5, o, mul3(col, 0.6));
    }
    if (look.fruiting && i < 3) {
      const p = along(pts, 0.75), s = 0.16 * clamp(W / def.matureWidth, 0.5, 1);
      const fc = jit(lin(def.fruitColor), r, 0.08);
      blob(X.acc, p.x, s * 0.75, p.z, s, s * 0.75, s, { kind: 'ico1', amp: 0.06, freq: 4, seed: i, shade: (x, y) => (y > s ? mul3(fc, 1.1) : mul3(fc, 0.75)) });
    }
  }
}

// ---------------------------------------------------------------- climber on its support (support is part of the model)
export function buildVine(X) {
  const { def, g, H, W, r, look } = X;
  const pal = leafPalette(X);
  const stemC = lin(g.bark || '#5a4a34');
  const leafy = look.leaf >= 0.35;
  const leafCard = (p, o, s) => {
    const col = jit(ramp(pal, clamp(0.35 + r() * 0.6, 0, 1)), r, 0.08);
    card(X.cards, p, o.clone().add(randUnit(r).multiplyScalar(0.5)).normalize(), UP, s, s, 0, col, r() < 0.5, o, mul3(col, 0.7));
  };
  if (g.support === 'obelisk') {
    const Hs = def.matureHeight * 1.08, b = 0.24, tp = 0.04, metal = lin('#2c2c2a');
    const at = (y) => b + (tp - b) * (y / Hs);
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
      tube(X.wood, [V(sx * b, 0, sz * b), V(sx * tp, Hs, sz * tp)], [0.012, 0.01], 4, metal);
    }
    for (const f of [0.25, 0.5, 0.75]) {
      const y = Hs * f, a = at(y);
      tube(X.wood, [V(-a, y, -a), V(a, y, -a), V(a, y, a), V(-a, y, a), V(-a, y, -a)], [0.006, 0.006, 0.006, 0.006, 0.006], 3, metal);
    }
    cone(X.wood, V(0, Hs, 0), UP, 0.04, 0.1, 6, metal);
    const top = Math.min(H, Hs);
    for (let s = 0; s < 3; s++) {
      const pts = [], a0 = s * 2.1;
      for (let y = 0; y <= top + 1e-6; y += Math.max(0.1, top / 7)) {
        const a = a0 + y * 2.2, rr = at(y) + 0.03;
        pts.push(V(Math.cos(a) * rr, y + 0.02, Math.sin(a) * rr));
      }
      if (pts.length < 2) continue;
      tube(X.wood, pts, pts.map((_, i) => 0.006 * (1 - i / pts.length) + 0.002), 3, stemC);
      if (!leafy) continue;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], o = V(p.x, 0.3, p.z).normalize();
        for (let k = 0; k < 3; k++) leafCard(p.clone().addScaledVector(o, 0.06).add(randUnit(r).multiplyScalar(0.06)), o, 0.2 * look.leaf + 0.05);
        if (look.flowering && r() < 0.7) {
          const fc = jit(lin(look.bloomColor), r, 0.08);
          card(X.cards, p.clone().addScaledVector(o, 0.12), o, UP, 0.13, 0.13, 3, fc, r() < 0.5, o, mul3(fc, 0.8));
        }
      }
    }
    if (leafy) {
      let P = pal;
      const shade = crownShade(X, top * 0.5, at(top * 0.5) + 0.1, top * 0.5, () => P);
      blob(X.fol, 0, top * 0.45, 0, at(top * 0.45) * 0.9 + 0.05, top * 0.4, at(top * 0.45) * 0.9 + 0.05, { kind: 'oct1', amp: 0.2, seed: 3, center: V(0, top * 0.4, 0), shade });
    }
    return;
  }
  // trellis: two posts, four wires along local X; cordon at the lowest wire with vertical shoots
  const Ws = Math.max(def.matureWidth, 1.6), half = Ws / 2, Hs = def.matureHeight * 0.95, wood = lin('#7a5e40'), wire = lin('#9a9a98');
  for (const sx of [-1, 1]) tube(X.wood, [V(sx * half, 0, 0), V(sx * half, Hs, 0)], [0.04, 0.035], 4, wood);
  const wires = [0.5, 0.9, 1.3, 1.7].map((f) => f * Hs / 1.9);
  for (const y of wires) tube(X.wood, [V(-half, y, 0), V(half, y, 0)], [0.003, 0.003], 3, wire);
  const y0 = wires[0], arm = Math.min(W / 2, half - 0.05);
  const tr = 0.012 + 0.012 * clamp(X.age / 6, 0, 1.5);
  tube(X.wood, [V(0.02, 0, 0.03), V(0, y0 * 0.6, 0.03), V(0, y0, 0.02)], [tr, tr * 0.9, tr * 0.8], 4, stemC);
  const blobs = [];
  for (const sx of [-1, 1]) {
    tube(X.wood, [V(0, y0, 0.02), V(sx * arm * 0.5, y0 + 0.02, 0.02), V(sx * arm, y0, 0.02)], [tr * 0.8, tr * 0.6, tr * 0.3], 4, stemC);
    const nShoot = Math.max(1, Math.round(arm / 0.22));
    for (let i = 1; i <= nShoot; i++) {
      const x = sx * arm * (i / nShoot) * 0.95;
      const ht = Math.max(y0 + 0.1, H * r.range(0.8, 1.0));
      const shootTop = leafy ? ht : y0 + 0.12;
      const pts = [V(x, y0, 0.02), V(x + r.range(-0.05, 0.05), (y0 + shootTop) / 2, 0.03), V(x + r.range(-0.08, 0.08), shootTop, 0.03)];
      tube(X.wood, pts, [0.006, 0.004, 0.002], 3, stemC);
      if (!leafy) continue;
      for (let k = 0; k < 4; k++) {
        const p = along(pts, r.range(0.15, 1)), o = V(r.range(-0.3, 0.3), 0.2, r.sign()).normalize();
        leafCard(p.clone().add(V(0, 0, o.z * 0.05)), o, 0.26);
      }
      blobs.push({ c: along(pts, 0.4).add(V(0, 0, 0)), rx: 0.08, ry: 0.06, rz: 0.08 });
    }
  }
  if (leafy) {
    let P = pal;
    const cy = (y0 + H) / 2;
    const shade = crownShade(X, cy, arm + 0.1, (H - y0) / 2 + 0.1, () => P);
    blob(X.fol, 0, cy, 0, arm * 0.95, Math.max(0.1, (H - y0) * 0.45), 0.12, { kind: 'oct1', amp: 0.25, seed: 5, center: V(0, cy, 0), shade });
  }
  if (look.fruiting && blobs.length && X.age >= (g.fruitAge ?? 2)) {
    const fc = lin(def.fruitColor);
    for (let i = 0; i < Math.min(10, blobs.length * 2); i++) {
      const b = blobs[i % blobs.length], p = b.c.clone().add(V(r.range(-0.08, 0.08), -0.02, r.sign() * 0.07));
      cone(X.acc, p, V(0, -1, 0), 0.045, 0.14, 6, jit(fc, r, 0.08), mul3(fc, 0.8));
    }
  }
}

export const BUILDERS = { tree: buildTree, conifer: buildConifer, spruce: buildSpruce, shrub: buildShrub, rose: buildShrub, herb: buildHerb, cane: buildCane, patch: buildPatch, vine: buildVine };
export { Buf };
