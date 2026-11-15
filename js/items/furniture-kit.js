// Furniture toolkit: a tiny geometry collector (merges all parts of one material into one mesh) and the shared
// materials + procedural textures used by js/items/furniture.js.  Textures are built lazily, once per page.
import * as THREE from '../lib/three.js';
import { BufferGeometryUtils } from '../lib/addons.js';
import { rng, paintTexture, jitterHex } from '../core/procedural.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3();

/** BoxGeometry whose UVs are in metres (1 uv unit = 1 m), so repeating textures keep their real scale on any face. */
function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // px, nx, py, ny, pz, nz
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
  }
  return g;
}

export class Kit {
  constructor() { this.map = new Map(); }

  /** Add any geometry (ownership passes to the kit). Euler order YXZ. */
  at(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s);
    geo.applyMatrix4(_m);
    let list = this.map.get(mat);
    if (!list) this.map.set(mat, list = []);
    list.push(geo);
    return this;
  }
  /** Box w×h×d centred at (x,y,z). */
  box(mat, w, h, d, x, y, z, rx, ry, rz) { return this.at(mat, boxGeo(w, h, d), x, y, z, rx, ry, rz); }
  cyl(mat, rt, rb, h, x, y, z, seg = 12, rx, ry, rz, open = false) {
    return this.at(mat, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), x, y, z, rx, ry, rz);
  }
  torus(mat, R, r, x, y, z, rx, ry, rz, rs = 5, ts = 18) {
    return this.at(mat, new THREE.TorusGeometry(R, r, rs, ts), x, y, z, rx, ry, rz);
  }
  /** Square bar w×d in section running from point a to point b ([x,y,z]). */
  bar(mat, w, d, a, b) {
    _a.set(...a); _b.set(...b);
    const len = _a.distanceTo(_b);
    _q.setFromUnitVectors(_up, _b.clone().sub(_a).normalize());
    _m.compose(_p.copy(_a).add(_b).multiplyScalar(0.5), _q, _s);
    const g = boxGeo(w, len, d); g.applyMatrix4(_m);
    return this._put(mat, g);
  }
  /** Round rod of radius r from a to b. */
  rod(mat, r, a, b, seg = 6) {
    _a.set(...a); _b.set(...b);
    const len = _a.distanceTo(_b);
    _q.setFromUnitVectors(_up, _b.clone().sub(_a).normalize());
    _m.compose(_p.copy(_a).add(_b).multiplyScalar(0.5), _q, _s);
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1); g.applyMatrix4(_m);
    return this._put(mat, g);
  }
  _put(mat, g) {
    let list = this.map.get(mat);
    if (!list) this.map.set(mat, list = []);
    list.push(g);
    return this;
  }
  /** → [{mat, geo}] one merged geometry per material. */
  build() {
    const out = [];
    for (const [mat, list] of this.map) {
      const geo = list.length === 1 ? list[0] : BufferGeometryUtils.mergeGeometries(list, false);
      geo.computeBoundingSphere();
      out.push({ mat, geo });
    }
    return out;
  }
}

// ------------------------------------------------------------------ textures
function woodTex(base, seed) {
  return paintTexture(128, 128, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const y = r() * h, dark = r() < 0.6;
      c.strokeStyle = dark ? `rgba(0,0,0,${0.05 + r() * 0.12})` : `rgba(255,255,255,${0.03 + r() * 0.06})`;
      c.lineWidth = 0.6 + r() * 1.6;
      c.beginPath(); c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y + r() * 4 - 2, w * 0.7, y + r() * 4 - 2, w, y); c.stroke();
    }
  }, { repeat: [1, 1] });
}
function aggregateTex() {
  return paintTexture(256, 256, (c, w, h) => {
    const r = rng(7);
    c.fillStyle = '#a3a097'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const cols = ['#8d8a82', '#bdb8ab', '#c9c2b0', '#77746c', '#a89c86', '#b5a58d'];
      c.fillStyle = jitterHex(r.pick(cols), r, 0.1);
      const x = r() * w, y = r() * h, rr = 1 + r() * 3.2;
      c.beginPath(); c.ellipse(x, y, rr, rr * (0.7 + r() * 0.3), r() * 3, 0, 6.3); c.fill();
    }
  }, { repeat: [1, 1] });
}
function canopyTex() {
  return paintTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#8e6b86'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.6;
    for (let y = 8; y < h + 16; y += 16) {
      c.beginPath();
      for (let x = 0; x <= w; x += 16) { const yy = y + ((x / 16) % 2 ? -6 : 6); x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
      c.stroke();
    }
  }, { repeat: [5, 3] });
}
function meshTex() {
  return paintTexture(32, 32, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#34373a';
    c.fillRect(0, 0, w, 5); c.fillRect(0, 0, 5, h);
  }, { repeat: [10, 4], mipmaps: false });
}
function brickTex() {
  return paintTexture(260, 225, (c, w, h) => {
    const r = rng(11);
    c.fillStyle = '#bdb7a8'; c.fillRect(0, 0, w, h);
    const bh = h / 12, bw = w / 4;
    for (let row = 0; row < 12; row++) for (let i = -1; i < 4; i++) {
      c.fillStyle = jitterHex('#9a4a38', r, 0.14);
      const x = i * bw + (row % 2 ? bw / 2 : 0);
      c.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }, { repeat: [1 / 1.04, 1 / 0.9] });
}

// ------------------------------------------------------------------ materials
const cache = new Map();
function make(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

export const M = {
  get anthracite() { return make('anth', () => std({ color: 0x3b3e41, roughness: 0.5, metalness: 0.5 })); },
  get blackSteel() { return make('blk', () => std({ color: 0x1c1d1f, roughness: 0.6, metalness: 0.5 })); },
  get galv() { return make('galv', () => std({ color: 0xaeb4b8, roughness: 0.4, metalness: 0.8 })); },
  get mesh() { return make('mesh', () => std({ color: 0xffffff, map: meshTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 })); },
  get canopy() { return make('canopy', () => std({ map: canopyTex(), side: THREE.DoubleSide, roughness: 0.9 })); },
  get mauve() { return make('mauve', () => std({ color: 0x8e6b86, side: THREE.DoubleSide })); },
  get plankDark() { return make('pd', () => std({ color: 0xffffff, map: woodTex('#5a2f25', 3) })); },
  get slatRed() { return make('sr', () => std({ color: 0xffffff, map: woodTex('#7a3b2a', 5) })); },
  get pine() { return make('pine', () => std({ color: 0xffffff, map: woodTex('#b98c58', 8) })); },
  get pineDark() { return make('pinedk', () => std({ color: 0xffffff, map: woodTex('#8a6a46', 9) })); },
  get concrete() { return make('conc', () => std({ color: 0xc9c7c0, roughness: 0.95 })); },
  get aggregate() { return make('agg', () => std({ color: 0xffffff, map: aggregateTex(), roughness: 0.95 })); },
  get dark() { return make('dark', () => std({ color: 0x1a1816, roughness: 1 })); },
  get mulch() { return make('mulch', () => std({ color: 0x3d2a1c, roughness: 1 })); },
  get soil() { return make('soil', () => std({ color: 0x3a2a1f, roughness: 1 })); },
  get compost() { return make('comp', () => std({ color: 0x2e2218, roughness: 1 })); },
  get mat() { return make('mat', () => std({ color: 0x141416, roughness: 0.95, side: THREE.DoubleSide })); },
  get padBlue() { return make('pad', () => std({ color: 0x1f4a99, roughness: 0.7, side: THREE.DoubleSide })); },
  get brick() { return make('brick', () => std({ color: 0xffffff, map: brickTex(), roughness: 0.95 })); },
  get brass() { return make('brass', () => std({ color: 0xb08d3a, roughness: 0.4, metalness: 0.8 })); },
  get barrel() { return make('barrel', () => std({ color: 0x2c5a86, roughness: 0.55 })); },
  get barrelLid() { return make('blid', () => std({ color: 0x1d3d5c, roughness: 0.6 })); },
  get alu() { return make('alu', () => std({ color: 0xaab0b4, roughness: 0.4, metalness: 0.7 })); },
  get cushion() { return make('cush', () => std({ color: 0xe6dfcb, roughness: 1 })); },
  get glass() {
    return make('glass', () => {
      const m = std({ color: 0xcfe6e0, roughness: 0.15, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
      m.userData.noShadow = true;
      return m;
    });
  },
  get ash() { return make('ash', () => std({ color: 0x4a4540, roughness: 1 })); },
};
