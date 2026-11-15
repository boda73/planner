// Ground layers: far plane, satellite context, lawn (with world-space detail), bare soil / sand strips, satellite overlay.
import * as THREE from '../lib/three.js';
import { fbm, makeCanvas, canvasTexture, hexToRgb } from '../core/procedural.js';

export const FAR_GROUND = '#586648';   // rgb(88,102,72)
const CTX = { X0: -12, X1: 26, Y0: -11, Y1: 34 };   // extent of context.jpg in plot metres

function plane(w, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

/** Tileable greyscale grass micro-detail, mean ≈ 0.5. */
function detailTexture(quality) {
  const N = quality === 'low' ? 128 : 256;
  const c = makeCanvas(N);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * 16, v = (y / N) * 16;
      const a = fbm(u, v, { octaves: 3, seed: 3, period: 16 });
      const blades = fbm(u * 3, v * 1.2, { octaves: 2, seed: 9, period: 48 });   // slightly streaky
      let g = 0.5 + (a - 0.5) * 0.9 + (blades - 0.5) * 0.6;
      g = Math.max(0, Math.min(1, g));
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g * 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c, { srgb: false, repeat: [1, 1], anisotropy: 4 });
}

/** Soil / sand overlay painted in plot coordinates (transparent PNG-like canvas, ragged soft edges). */
function soilTexture(site, quality) {
  const ppm = quality === 'low' ? 24 : 48;
  const W = site.plot.width * ppm, H = site.plot.depth * ppm;
  const mask = makeCanvas(W, H);
  const m = mask.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, W, H);
  const rect = (X0, Y0, X1, Y1, col) => {      // plot rect → canvas rect (canvas y runs down = −Y)
    m.fillStyle = col;
    m.fillRect(X0 * ppm, (site.plot.depth - Y1) * ppm, (X1 - X0) * ppm, (Y1 - Y0) * ppm);
  };
  const s = site.shed.rect;
  m.globalCompositeOperation = 'lighter';
  rect(-0.2, 22.7, 17.0, 24.6, '#f00');                              // strip in front of the thuja hedge
  rect(s[0] - 0.7, s[1] - 0.8, s[2] + 0.7, s[3] + 0.6, '#f00');     // around the shed
  rect(17.0, 23.2, 20.2, 24.9, '#f00');
  rect(19.45, 8.0, 20.2, 22.7, '#0f0');                              // sand between path and east fence
  m.globalCompositeOperation = 'source-over';
  const blur = makeCanvas(W, H);
  const b = blur.getContext('2d');
  b.filter = `blur(${Math.round(ppm * 0.18)}px)`;
  b.drawImage(mask, 0, 0);
  const md = b.getImageData(0, 0, W, H).data;

  const out = makeCanvas(W, H);
  const o = out.getContext('2d');
  const img = o.createImageData(W, H);
  const soil = hexToRgb('#6b563f'), soilDark = hexToRgb('#4f3f2e'), sand = hexToRgb('#b6a47d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const ms = md[i] / 255, mg = md[i + 1] / 255;
      const cov = Math.max(ms, mg);
      if (cov < 0.02) continue;
      const X = x / ppm, Y = y / ppm;
      const n = fbm(X * 3.2, Y * 3.2, { octaves: 3, seed: 21 });
      const n2 = fbm(X * 14, Y * 14, { octaves: 2, seed: 5 });
      const k = n2 * 0.7 + n * 0.3;
      let r, g, bl;
      if (ms >= mg) { const t = Math.min(1, k * 1.6); r = soilDark[0] + (soil[0] - soilDark[0]) * t; g = soilDark[1] + (soil[1] - soilDark[1]) * t; bl = soilDark[2] + (soil[2] - soilDark[2]) * t; }
      else { const t = 0.85 + (k - 0.5) * 0.35; r = sand[0] * t; g = sand[1] * t; bl = sand[2] * t; }
      // ragged edge: threshold the soft mask with noise
      const a = Math.max(0, Math.min(1, (cov - 0.25 - (n - 0.5) * 0.7) * 3.2));
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = bl; img.data[i + 3] = a * 255;
    }
  }
  o.putImageData(img, 0, 0);
  return canvasTexture(out, { srgb: true, anisotropy: 8 });
}

export function createGround({ site, lawnTex, contextTex, quality, maxAniso }) {
  const group = new THREE.Group();
  group.name = 'ground';
  const { width: PW, depth: PD } = site.plot;

  // far plane (fades into fog / horizon)
  const farMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(FAR_GROUND), roughness: 1 });
  const far = plane(2000, 2000, PW / 2, -0.03, -PD / 2, farMat);
  far.receiveShadow = false;
  group.add(far);

  // satellite context (X −12…26, Y −11…34)
  if (contextTex) {
    contextTex.anisotropy = Math.min(8, maxAniso);
    const ctxMat = new THREE.MeshStandardMaterial({ map: contextTex, roughness: 1 });
    group.add(plane(CTX.X1 - CTX.X0, CTX.Y1 - CTX.Y0, (CTX.X0 + CTX.X1) / 2, -0.015, -(CTX.Y0 + CTX.Y1) / 2, ctxMat));
  }

  // lawn with world-space micro detail
  const detail = detailTexture(quality);
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
  if (lawnTex) lawnTex.anisotropy = maxAniso;
  const lawnMat = new THREE.MeshStandardMaterial({ map: lawnTex || null, color: lawnTex ? 0xffffff : 0x6f8f3f, roughness: 1 });
  lawnMat.onBeforeCompile = (sh) => {
    sh.uniforms.detailTex = { value: detail };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;\nuniform sampler2D detailTex;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dA = texture2D(detailTex, vWXZ * 2.3).r;
        float dB = texture2D(detailTex, vWXZ * 0.43 + 0.31).r;
        float dC = texture2D(detailTex, vWXZ * 7.1 + 0.77).r;
        diffuseColor.rgb *= (1.0 + (dA - 0.5) * 1.5) * (1.0 + (dB - 0.5) * 0.9) * (1.0 + (dC - 0.5) * 1.7);`);
  };
  const lawn = plane(PW, PD, PW / 2, 0, -PD / 2, lawnMat);
  group.add(lawn);

  // soil / sand strips
  const soilMat = new THREE.MeshStandardMaterial({ map: soilTexture(site, quality), roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  soilMat.map.anisotropy = Math.min(8, maxAniso);
  const soil = plane(PW, PD, PW / 2, 0.006, -PD / 2, soilMat);
  soil.renderOrder = 1;
  group.add(soil);

  // satellite overlay: X −2…22, Y −2…27 cut from the context image
  let overlay = null;
  if (contextTex) {
    const t = contextTex.clone();
    t.needsUpdate = true;
    const cw = CTX.X1 - CTX.X0, ch = CTX.Y1 - CTX.Y0;
    t.repeat.set(24 / cw, 29 / ch);
    t.offset.set((-2 - CTX.X0) / cw, (-2 - CTX.Y0) / ch);
    const om = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, fog: false });
    overlay = plane(24, 29, 10, 0.03, -12.5, om);
    overlay.receiveShadow = false;
    overlay.visible = false;
    overlay.renderOrder = 5;
    group.add(overlay);
  }

  const TINT = {
    spring: [1.0, 1.08, 1.0], summer: [1.05, 1.05, 1.05], autumn: [1.2, 1.0, 1.7], winter: [0.95, 0.95, 1.0],
  };
  return {
    group, lawn,
    setSeason(season) { const t = TINT[season] || TINT.summer; lawnMat.color.setRGB(t[0], t[1], t[2]); },
    setOverlay(opacity) {
      if (!overlay) return;
      overlay.material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
      overlay.visible = opacity > 0.001;
    },
  };
}
