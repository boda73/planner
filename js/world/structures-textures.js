// Procedural canvas textures for the cottage and the shed (no downloaded assets).
// Every texture is made for geometry whose UVs are in METRES: `tex(...)` sets repeat = 1 / tileSize,
// so a texture drawn for a 1.0 × 0.5 m tile repeats every 1.0 m along U and 0.5 m along V.
import * as THREE from '../lib/three.js';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

/**
 * @param {string} key cache key
 * @param {number} w canvas px   @param {number} h canvas px
 * @param {(ctx, w, h, r) => void} draw
 * @param {{tile?:[number,number], color?:boolean}} o tile = metres covered by one canvas (U, V)
 */
export function tex(key, w, h, draw, { tile = [1, 1], color = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h, rng(key.length * 7919 + w));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile[0], 1 / tile[1]);
  t.anisotropy = 4;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  cache.set(key, t);
  return t;
}

function noise(ctx, w, h, r, n, size, colors, alpha = 0.15) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    const s = size * (0.5 + r());
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/** Off-white render, 1 × 1 m tile. */
export const plasterTex = () => tex('plaster', 256, 256, (c, w, h, r) => {
  c.fillStyle = '#efede6'; c.fillRect(0, 0, w, h);
  noise(c, w, h, r, 2500, 2, ['#ffffff', '#d8d5cb', '#e6e2d6'], 0.35);
  noise(c, w, h, r, 60, 18, ['#dcd9cf', '#f7f6f1'], 0.12);
}, { tile: [1, 1] });

/** Bump for the render: fine grain. */
export const plasterBump = () => tex('plasterBump', 128, 128, (c, w, h, r) => {
  c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
  noise(c, w, h, r, 2500, 1.5, ['#606060', '#a0a0a0'], 0.5);
}, { tile: [0.5, 0.5], color: false });

/** OSB: pale or stained flakes. 0.6 × 0.6 m tile. */
export const osbTex = (base = '#a9763f', key = 'osb') => tex(key + base, 256, 256, (c, w, h, r) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  const col = new THREE.Color(base);
  for (let i = 0; i < 900; i++) {
    const k = 0.75 + r() * 0.5;
    c.fillStyle = `rgb(${Math.min(255, col.r * 255 * k) | 0},${Math.min(255, col.g * 255 * k) | 0},${Math.min(255, col.b * 255 * k) | 0})`;
    c.globalAlpha = 0.55;
    c.save();
    c.translate(r() * w, r() * h);
    c.rotate((r() - 0.5) * 0.9);
    c.fillRect(-10 - r() * 14, -3 - r() * 3, 20 + r() * 28, 6 + r() * 5);
    c.restore();
  }
  c.globalAlpha = 1;
}, { tile: [0.6, 0.6] });

/** Old vertical boards of the west face, one canvas = whole wall (3.4 × 2.8 m), grey-brown with faded paint. */
export const oldBoardsTex = () => tex('oldBoards', 512, 512, (c, w, h, r) => {
  const pxPerM = w / 3.4;
  let x = 0;
  while (x < w) {
    const bw = (0.11 + r() * 0.06) * pxPerM;
    const g = 105 + r() * 40;
    c.fillStyle = `rgb(${g + 8 | 0},${g | 0},${g - 12 | 0})`;
    c.fillRect(x, 0, bw, h);
    for (let k = 0; k < 14; k++) {          // grain
      c.globalAlpha = 0.18;
      c.fillStyle = r() < 0.5 ? '#4e4740' : '#bdb6a8';
      c.fillRect(x + r() * bw, 0, 1, h);
    }
    c.globalAlpha = 1;
    c.fillStyle = '#2d2924';                // joint
    c.fillRect(x, 0, 2, h);
    x += bw;
  }
  // faded paint patches (children's paint, old colours)
  const paints = ['#4f86b8', '#c24a43', '#3f9c8f', '#d8b04a', '#8d5aa0', '#e0e0d8'];
  for (let i = 0; i < 26; i++) {
    c.globalAlpha = 0.18 + r() * 0.25;
    c.fillStyle = paints[(r() * paints.length) | 0];
    c.beginPath();
    const cx = r() * w, cy = h * (0.25 + r() * 0.65), rr = 8 + r() * 34;
    c.ellipse(cx, cy, rr, rr * (0.6 + r()), r() * 3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 0.3;                      // weathering darker at the bottom
  const g = c.createLinearGradient(0, h, 0, h * 0.75);
  g.addColorStop(0, '#2a241e'); g.addColorStop(1, 'rgba(42,36,30,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.globalAlpha = 1;
}, { tile: [3.4, 2.8] });

/** Burgundy-brown metal sheet colour (weathering streaks down the slope). U = along the ridge, V = down slope. */
export const roofSheetTex = () => tex('roofSheet', 256, 256, (c, w, h, r) => {
  c.fillStyle = '#6f2f38'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    c.globalAlpha = 0.06 + r() * 0.08;
    c.fillStyle = r() < 0.6 ? '#4f2026' : '#8a4a50';
    c.fillRect(r() * w, r() * h, 1 + r() * 3, 20 + r() * 120);
  }
  c.globalAlpha = 1;
}, { tile: [1, 1] });

/** Minor stiffening ribs between the main trapezoid ribs (bump). U along ridge. */
export const roofSheetBump = () => tex('roofSheetBump', 64, 8, (c, w, h) => {
  c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#a0a0a0';
  c.fillRect(w * 0.25, 0, 3, h); c.fillRect(w * 0.75, 0, 3, h);
}, { tile: [0.2, 0.2], color: false });

/** Dark grey roofing felt with sanded granules and overlap seams, 1 × 1 m. */
export const feltTex = () => tex('felt', 256, 256, (c, w, h, r) => {
  c.fillStyle = '#3c3d3f'; c.fillRect(0, 0, w, h);
  noise(c, w, h, r, 4000, 1.5, ['#5b5c5e', '#2a2b2c', '#4a4a48'], 0.6);
  c.fillStyle = '#2b2c2d';
  c.fillRect(0, h * 0.5, w, 3); c.fillRect(0, 0, w, 3);
}, { tile: [1, 1] });

/** Grey soffit boards, 1 × 1 m. */
export const soffitTex = () => tex('soffit', 128, 128, (c, w, h, r) => {
  c.fillStyle = '#8d8d8a'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += w / 8) { c.fillStyle = '#6c6c69'; c.fillRect(x, 0, 2, h); }
  noise(c, w, h, r, 400, 2, ['#9a9a96', '#7d7d7a'], 0.4);
}, { tile: [1, 1] });

/** Shed slat face: warm orange-brown wood print, vertical grain. One slat wide (U) × 1 m (V). */
export const slatTex = () => tex('slat', 64, 256, (c, w, h, r) => {
  c.fillStyle = '#a4662f'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    c.globalAlpha = 0.25 + r() * 0.3;
    c.strokeStyle = r() < 0.6 ? '#7a4520' : '#c38449';
    c.lineWidth = 0.6 + r() * 1.6;
    c.beginPath();
    let x = r() * w;
    c.moveTo(x, 0);
    for (let y = 0; y <= h; y += 16) { x += (r() - 0.5) * 2.5; c.lineTo(x, y); }
    c.stroke();
  }
  c.globalAlpha = 1;
}, { tile: [0.092, 1] });

/** Black bitumen shingles: rows of tabs, 1.0 m (U) × 0.28 m (V, two courses). */
export const shingleTex = () => tex('shingle', 256, 128, (c, w, h, r) => {
  c.fillStyle = '#2b2b2d'; c.fillRect(0, 0, w, h);
  noise(c, w, h, r, 3000, 1.5, ['#3e3f42', '#1e1e20', '#35363a'], 0.6);
  const rowH = h / 2, tabW = w / 3;
  for (let row = 0; row < 2; row++) {
    const y = row * rowH;
    c.fillStyle = '#121213';
    c.fillRect(0, y + rowH - 3, w, 3);                       // course shadow line
    for (let k = 0; k <= 3; k++) {
      const x = k * tabW + (row % 2) * tabW / 2;
      c.fillRect(x % w, y + rowH * 0.35, 2, rowH * 0.65);   // tab slots
    }
  }
}, { tile: [1.0, 0.28] });

/** Brown wooden door / annex boards (stained, mottled). 1 × 1 m. */
export const brownBoardTex = (base = '#6a4630', key = 'brownBoard') => tex(key, 256, 256, (c, w, h, r) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  noise(c, w, h, r, 700, 9, ['#4f3322', '#7d5539', '#5e3d29'], 0.25);
  for (let i = 0; i < 50; i++) {
    c.globalAlpha = 0.15;
    c.fillStyle = r() < 0.5 ? '#3d271a' : '#86603f';
    c.fillRect(0, r() * h, w, 1 + r() * 2);
  }
  c.globalAlpha = 1;
}, { tile: [1, 1] });
