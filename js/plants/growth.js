// Growth curves. Pure maths, no three.js (runs in Node for tuning).
//
// size(a) = s0 + (S − s0) · G(a / yearsToMature)
// G(t) = [1 − (1 − t^q)^p + c·t] / (1 + c)                          for t ≤ 1  (slow start for q > 1, saturates)
//      = [1 + c + c·τ·(1 − e^{−(t−1)/τ})] / (1 + c)                for t > 1  (slow creep, C¹-continuous at t = 1)
// so G(0) = 0, G(1) = 1 and the plant keeps creeping up to +c·τ/(1+c) (≈ 11 %) of its mature size.
import { PLANTS } from './catalog.js';

const byId = new Map(PLANTS.map((p) => [p.id, p]));
const C = 0.08, TAU = 1.5;

function G(t, p, q) {
  if (t <= 0) return 0;
  if (t <= 1) return (1 - Math.pow(1 - Math.pow(t, q), p) + C * t) / (1 + C);
  return (1 + C + C * TAU * (1 - Math.exp(-(t - 1) / TAU))) / (1 + C);
}
const G_MAX = (1 + C + C * TAU) / (1 + C);

function params(def) {
  const g = def.grow || {};
  const p = g.p ?? 1.6, q = g.q ?? 1;
  return {
    h0: g.h0 ?? Math.min(0.1, def.matureHeight * 0.1), w0: g.w0 ?? Math.min(0.08, def.matureWidth * 0.1),
    p, q, pw: g.pw ?? p, qw: g.qw ?? q,
  };
}

export function plantSizeAt(id, age) {
  const def = byId.get(id);
  if (!def) return { height: 1, width: 1 };
  const k = params(def);
  const t = Math.max(0, +age || 0) / def.yearsToMature;
  return {
    height: k.h0 + (def.matureHeight - k.h0) * G(t, k.p, k.q),
    width: k.w0 + (def.matureWidth - k.w0) * G(t, k.pw, k.qw),
  };
}

/** Exact inverse of plantSizeAt(id, age).height, clamped to [0, age where 99.9 % of the creep is reached]. */
export function ageForHeight(id, height) {
  const def = byId.get(id);
  if (!def) return 0;
  const k = params(def);
  const y = (height - k.h0) / (def.matureHeight - k.h0);
  if (!(y > 0)) return 0;
  const tMax = 1 - TAU * Math.log(0.001);
  if (y >= G(tMax, k.p, k.q)) return tMax * def.yearsToMature;
  let lo = 0, hi = tMax;                      // G is strictly increasing → bisection to 1e-9
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (G(mid, k.p, k.q) < y) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * def.yearsToMature;
}

/** Trunk radius (m) for trees: grows with height and keeps thickening slowly with age. */
export function trunkRadiusAt(id, age) {
  const def = byId.get(id);
  const d = def?.g?.trunkD;
  if (!d) return 0;
  const { height } = plantSizeAt(id, age);
  const r = (d / 2) * Math.pow(Math.min(height / def.matureHeight, 1.12), 1.5) * (1 + 0.15 * Math.max(0, age / def.yearsToMature - 1));
  return Math.max(0.006, r);
}

export { G_MAX };
