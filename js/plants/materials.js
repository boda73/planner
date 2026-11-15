// Shared plant materials (module-level, never disposed by callers) and the leaf-card atlas.
// All colour comes from vertex colours; the atlas is near-white greyscale with alpha so it only adds shape/shading.
import * as THREE from '../lib/three.js';
import { rng, paintTexture } from '../core/procedural.js';

let MATS = null;

function grey(ctx, v, a = 1) { ctx.fillStyle = `rgba(${v},${v},${v},${a})`; ctx.strokeStyle = ctx.fillStyle; }

function leaf(ctx, x, y, ang, len, wid, v) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, 0, -len);
  g.addColorStop(0, `rgb(${v * 0.7},${v * 0.7},${v * 0.7})`); g.addColorStop(1, `rgb(${v},${v},${v})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(wid, -len * 0.45, 0, -len);
  ctx.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
  ctx.fill();
  grey(ctx, v * 0.72, 0.8); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -len * 0.9); ctx.stroke();
  ctx.restore();
}

function drawAtlas(ctx, S) {
  const C = S / 2, r = rng(7);
  ctx.clearRect(0, 0, S, S);
  ctx.lineCap = 'round';
  const cell = (qx, qy, fn) => { ctx.save(); ctx.translate(qx * C, qy * C); ctx.beginPath(); ctx.rect(0, 0, C, C); ctx.clip(); fn(); ctx.restore(); };
  // 0: broadleaf tuft (twig with leaves radiating upwards)
  cell(0, 0, () => {
    for (let i = 0; i < 26; i++) {
      const a = r.range(-1.5, 1.5), d = r.range(10, C * 0.32);
      const x = C / 2 + Math.sin(a) * d * 0.9, y = C * 0.62 - Math.cos(a) * d * 0.8;
      leaf(ctx, x, y, a + r.range(-0.5, 0.5), r.range(C * 0.2, C * 0.32), r.range(C * 0.07, C * 0.1), r.range(185, 255));
    }
  });
  // 1: thuja scale spray (flat fractal fronds)
  cell(1, 0, () => {
    const frond = (x, y, a, len, w, depth, v) => {
      const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
      grey(ctx, v); ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      if (depth <= 0) return;
      const n = 5;
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1), side = i % 2 ? 1 : -1;
        frond(x + (x2 - x) * t, y + (y2 - y) * t, a + side * r.range(0.6, 0.9), len * (0.5 - t * 0.25), w * 0.75, depth - 1, Math.min(255, v + r.range(0, 25)));
      }
    };
    for (let i = 0; i < 7; i++) frond(C / 2 + r.range(-30, 30), C * 0.98, r.range(-0.7, 0.7), C * r.range(0.6, 0.85), 9, 2, r.range(150, 210));
  });
  // 2: needles (shoots with needles on both sides)
  cell(0, 1, () => {
    for (let k = 0; k < 9; k++) {
      const x0 = C / 2 + r.range(-25, 25), y0 = C * 0.95, a = r.range(-0.9, 0.9), len = C * r.range(0.5, 0.85);
      const x1 = x0 + Math.sin(a) * len, y1 = y0 - Math.cos(a) * len;
      grey(ctx, 150); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      for (let t = 0.05; t < 1; t += 0.045) {
        const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        for (const s of [-1, 1]) {
          const na = a + s * r.range(0.5, 0.9), nl = r.range(16, 26) * (1.1 - t * 0.4);
          grey(ctx, r.range(170, 255)); ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(na) * nl, py - Math.cos(na) * nl); ctx.stroke();
        }
      }
    }
  });
  // 3: blossom (dense five-petal flowers)
  cell(1, 1, () => {
    for (let i = 0; i < 46; i++) {
      const x = r.range(18, C - 18), y = r.range(18, C - 18), pr = r.range(6, 11), v = r.range(215, 255);
      grey(ctx, v);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + i;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * pr, y + Math.sin(a) * pr, pr * 0.75, 0, Math.PI * 2); ctx.fill();
      }
      grey(ctx, 150); ctx.beginPath(); ctx.arc(x, y, pr * 0.4, 0, Math.PI * 2); ctx.fill();
    }
  });
}

export function plantMaterials() {
  if (MATS) return MATS;
  const atlas = paintTexture(512, 512, drawAtlas, { srgb: true, anisotropy: 4 });
  MATS = {
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    foliage: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
    cards: new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, alphaTest: 0.42, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
    accent: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 }),
  };
  for (const [k, m] of Object.entries(MATS)) m.name = 'plant-' + k;
  return MATS;
}
