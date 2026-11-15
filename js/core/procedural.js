// Shared procedural toolkit: seeded RNG, value noise, colour helpers, canvas → texture, height → normal map.
// Every module (world, structures, furniture, plants) builds its textures through these helpers.
import * as THREE from '../lib/three.js';

/** Deterministic PRNG (mulberry32).  const r = rng(42);  r() → [0,1);  r.range(a,b);  r.int(a,b);  r.pick(arr);  r.sign() */
export function rng(seed = 1) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const f = () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());      // inclusive
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}

/** Hash of an integer lattice point → [0,1). */
export function hash2(ix, iy, seed = 0) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul((seed | 0) + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise → [0,1). `period` > 0 makes it tile every `period` units (seamless textures). */
export function valueNoise(x, y, seed = 0, period = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const w = period > 0 ? (n) => ((n % period) + period) % period : (n) => n;
  const a = hash2(w(ix), w(iy), seed), b = hash2(w(ix + 1), w(iy), seed);
  const c = hash2(w(ix), w(iy + 1), seed), d = hash2(w(ix + 1), w(iy + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise → ~[0,1]. With `period`, x/y are expected in [0, period) and the result tiles. */
export function fbm(x, y, { octaves = 4, lacunarity = 2, gain = 0.5, seed = 0, period = 0 } = {}) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 101, period * f);
    norm += amp; amp *= gain; f *= lacunarity;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- colours (plain sRGB maths, for canvas painting)
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
/** Linear mix of two hex colours, t ∈ [0,1]. */
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
/** Multiply brightness: k < 1 darker, k > 1 lighter. */
export function shadeHex(hex, k) {
  const c = hexToRgb(hex);
  return rgbToHex(c[0] * k, c[1] * k, c[2] * k);
}
/** Random variation of a colour: brightness ±amount and a little per-channel drift. */
export function jitterHex(hex, rnd, amount = 0.08) {
  const c = hexToRgb(hex), k = 1 + (rnd() * 2 - 1) * amount;
  return rgbToHex(c[0] * k * (1 + (rnd() - 0.5) * amount), c[1] * k * (1 + (rnd() - 0.5) * amount), c[2] * k * (1 + (rnd() - 0.5) * amount));
}

// ---------------------------------------------------------------- canvas → texture
export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/**
 * Wrap a canvas as a texture. srgb: true for colour maps, false for data (normal / roughness / alpha).
 * repeat: [u, v] turns on RepeatWrapping.
 */
export function canvasTexture(canvas, { srgb = true, repeat = null, anisotropy = 8, mipmaps = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = anisotropy;
  t.generateMipmaps = mipmaps;
  if (!mipmaps) t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** paintTexture(256, 256, (ctx, w, h) => { … }, opts) → texture. */
export function paintTexture(w, h, draw, opts) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  return canvasTexture(c, opts);
}

/**
 * Tangent-space normal map (OpenGL convention, as three.js expects) from a greyscale height canvas (white = high).
 * `strength` ≈ bump height in texels. Edges wrap, so a tileable height map gives a tileable normal map.
 */
export function normalMapFromHeight(heightCanvas, strength = 2) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = -(H(x + 1, y) - H(x - 1, y)) * strength;
      const ny = (H(x, y + 1) - H(x, y - 1)) * strength;      // canvas y runs down, texture v runs up
      const l = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}
