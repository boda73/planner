// Furniture gallery. URL: ?focus=<id> close-up of one item · ?az=<deg> camera azimuth (focus) · ?tri=1 log triangle counts
import * as THREE from '../js/lib/three.js';
import { createRenderer } from '../js/core/renderer.js';
import { FURNITURE, createFurniture } from '../js/items/furniture.js';

const q = new URLSearchParams(location.search);
const focus = q.get('focus');
const canvas = document.getElementById('c');
const renderer = createRenderer({ canvas });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd8dc);
scene.fog = new THREE.Fog(0xcfd8dc, 40, 90);

scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x6d705f, 1.0));
const sun = new THREE.DirectionalLight(0xfff1da, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target);

function label(text, h = 0.32) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = 'bold 40px sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  c.width = w; c.height = 64;
  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = 'rgba(20,28,24,0.78)';
  ctx.beginPath(); ctx.roundRect(0, 4, w, 56, 14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, 14, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set((w / 64) * h, h, 1);
  s.renderOrder = 999;
  return s;
}

// layout: rows of items, each in a cell of max(w,d)+0.9 m
const items = focus ? FURNITURE.filter((f) => f.id === focus) : FURNITURE;
const dims = (f) => ({ w: f.footprint.w ?? f.footprint.r * 2, d: f.footprint.d ?? f.footprint.r * 2 });
const rowMax = 17;
let cx = 0, cz = 0, rowD = 0, maxX = 0;
const placed = [];
for (const f of items) {
  const { w, d } = dims(f), cell = Math.max(w, 0.9) + 0.9;
  if (cx + cell > rowMax && cx > 0) { cz += rowD + 1.2; cx = 0; rowD = 0; }
  placed.push({ f, x: cx + cell / 2, z: cz + d / 2, d });
  cx += cell; rowD = Math.max(rowD, d); maxX = Math.max(maxX, cx);
}
const totalD = cz + rowD;

for (const p of placed) {
  const obj = createFurniture(p.f.id);
  obj.position.set(p.x, 0, p.z);
  scene.add(obj);
  const l = label(p.f.name);
  l.position.set(p.x, p.f.matureHeight + 0.35, p.z - p.d / 2 + 0.05);
  scene.add(l);
  if (q.get('tri')) {
    let t = 0; obj.traverse((o) => { if (o.isMesh) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    console.warn(p.f.id, 'triangles', t);
  }
}

// reference post 1.7 m
const postX = focus ? maxX + 0.4 : -0.6;
const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), new THREE.MeshStandardMaterial({ color: 0xd9381e, roughness: 0.6 }));
post.position.set(postX, 0.85, 0.3); post.castShadow = post.receiveShadow = true;
scene.add(post);
const pl = label('1,7 м', 0.26); pl.position.set(postX, 1.95, 0.3); scene.add(pl);

// ground + 1 m grid
const gw = Math.ceil(maxX + 4), gd = Math.ceil(totalD + 4), gx0 = Math.floor(-2), gz0 = Math.floor(-2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshStandardMaterial({ color: 0x8e9684, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(gx0 + gw / 2, 0, gz0 + gd / 2); ground.receiveShadow = true;
scene.add(ground);
const pts = [];
for (let x = 0; x <= gw; x++) pts.push(gx0 + x, 0.004, gz0, gx0 + x, 0.004, gz0 + gd);
for (let z = 0; z <= gd; z++) pts.push(gx0, 0.004, gz0 + z, gx0 + gw, 0.004, gz0 + z);
const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
scene.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x4b5646, transparent: true, opacity: 0.45 })));

// camera (fixed) — in the overview it sits north of the rows looking south-ish onto the item fronts (front = −Z)
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
const midX = maxX / 2, midZ = totalD / 2;
if (focus) {
  const f = items[0], { w, d } = dims(f);
  const size = Math.max(w, d, f.matureHeight * 1.2), dist = size * 2.1 + 1.2;
  const az = THREE.MathUtils.degToRad(Number(q.get('az') ?? 28)), el = THREE.MathUtils.degToRad(24);
  const t = new THREE.Vector3(placed[0].x, f.matureHeight * 0.45, placed[0].z);
  camera.position.set(t.x + Math.sin(az) * Math.cos(el) * dist, t.y + Math.sin(el) * dist, t.z - Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(t);
} else {
  camera.position.set(midX + 1, 11 + totalD * 0.5, -Math.max(maxX, 12) * 0.78 - 2);
  camera.lookAt(midX, 0.4, midZ + 0.5);
}
sun.position.set(midX - 8, 14, midZ - 9);
sun.target.position.set(midX, 0, midZ);
const sc = sun.shadow.camera; const ext = Math.max(maxX, totalD) * 0.8 + 3;
sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 60; sc.updateProjectionMatrix();
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let frames = 0;
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  if (++frames === 3) window.__READY = true;
});
