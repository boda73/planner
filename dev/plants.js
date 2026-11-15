// Plant gallery: every species of a category in a grid on neutral ground (1 m grid, 1.7 m reference post).
//
// URL params (all optional):
//   cat=<category|all>     category id from registry.CATEGORIES (default all)
//   age=<years|mature|start>   default: start (= def.startAge); 'mature' = yearsToMature
//   season=summer|spring|autumn|winter   month=1..12 (refines the look)
//   id=<species>           single close-up of one species (four seed variants side by side)
//   seed=1   cam=X,Y,Z,tx,ty,tz (world coords)   labels=0
// Sets window.__READY = true after the first frames; window.__plantStats = per-species triangles / build ms.
import * as THREE from '../js/lib/three.js';
import { createRenderer } from '../js/core/renderer.js';
import { CATEGORIES } from '../js/items/registry.js';
import { PLANTS } from '../js/plants/catalog.js';
import { createPlant, plantSizeAt, plantCacheStats, clearPlantCache } from '../js/plants/generate.js';

const q = new URLSearchParams(location.search);
const errBox = document.getElementById('err');
const showErr = (m) => { errBox.textContent += m + '\n'; };
window.addEventListener('error', (e) => showErr('ERROR: ' + e.message));
window.addEventListener('unhandledrejection', (e) => showErr('REJECTION: ' + (e.reason?.message || e.reason)));

const renderer = createRenderer({ canvas: document.getElementById('c') });
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8c8d8);
scene.add(new THREE.HemisphereLight(0xdfe8f4, 0x6a6458, 1.1));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
scene.add(sun, sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;

const season = q.get('season') || 'summer';
const month = q.has('month') ? +q.get('month') : undefined;
const cat = q.get('cat') || 'all';
const single = q.get('id');
const ageOf = (def) => {
  const a = q.get('age') || 'start';
  return a === 'mature' ? def.yearsToMature : a === 'start' ? def.startAge : +a;
};

function label(text, sub) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(20,24,28,0.72)';
  x.fillRect(0, 0, 512, 96);
  x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center';
  x.fillText(text, 256, 42, 500);
  x.fillStyle = '#c8d4dc'; x.font = '24px sans-serif';
  x.fillText(sub, 256, 80, 500);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.renderOrder = 10;
  return s;
}

function main() {
  const list = single ? [PLANTS.find((p) => p.id === single)].filter(Boolean)
    : PLANTS.filter((p) => cat === 'all' || p.category === cat);
  if (!list.length) throw new Error('no species for ' + (single || cat));
  const entries = single ? [0, 1, 2, 3].map((s) => ({ def: list[0], seed: s })) : list.map((def) => ({ def, seed: +(q.get('seed') || 1) }));

  // layout: rows ordered as given, cell size = width at that age + margin
  const cols = Math.ceil(Math.sqrt(entries.length * 1.6));
  let x = 0, z = 0, rowDepth = 0, maxX = 0, maxH = 0;
  const stats = [];
  entries.forEach((e, i) => {
    const age = ageOf(e.def);
    const { height, width } = plantSizeAt(e.def.id, age);
    const cell = Math.max(1.2, width + 0.6);
    if (i && i % cols === 0) { x = 0; z -= rowDepth; rowDepth = 0; }
    const t0 = performance.now();
    const obj = createPlant(e.def.id, { age, season, month, seed: e.seed });
    const ms1 = performance.now() - t0;
    const t1 = performance.now();
    createPlant(e.def.id, { age, season, month, seed: e.seed });       // cached repeat
    const ms2 = performance.now() - t1;
    obj.position.set(x + cell / 2, 0, z - cell / 2);
    scene.add(obj);
    stats.push({ id: e.def.id, age: +age.toFixed(1), h: +height.toFixed(2), w: +width.toFixed(2), tris: obj.userData.triangles, buildMs: +ms1.toFixed(2), cachedMs: +ms2.toFixed(3) });
    if (q.get('labels') !== '0') {
      const l = label(e.def.name, `${height.toFixed(1)} × ${width.toFixed(1)} м · ${age} р · ${obj.userData.triangles} △`);
      const sc = Math.max(0.9, Math.min(cell * 0.95, 2.4));
      l.scale.set(sc, sc * 96 / 512, 1);
      l.position.set(x + cell / 2, height + 0.25 + sc * 0.1, z - cell / 2);
      scene.add(l);
    }
    maxH = Math.max(maxH, height);
    x += cell; maxX = Math.max(maxX, x); rowDepth = Math.max(rowDepth, cell);
  });
  const minZ = z - rowDepth;
  window.__plantStats = { plants: stats, cache: plantCacheStats() };

  // ground + 1 m grid + 1.7 m reference post
  const gw = maxX + 4, gd = -minZ + 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(maxX / 2, 0, minZ / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(Math.ceil(Math.max(gw, gd)), Math.ceil(Math.max(gw, gd)), 0x5a5a54, 0x6e6e66);
  grid.position.set(maxX / 2, 0.002, minZ / 2);
  scene.add(grid);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), new THREE.MeshStandardMaterial({ color: 0xd04020 }));
  post.position.set(-0.4, 0.85, 0.4);
  post.castShadow = true;
  scene.add(post);

  // sun from the south-west-ish, shadow box around the gallery
  const cx = maxX / 2, cz = minZ / 2, span = Math.max(gw, gd, maxH * 2);
  sun.position.set(cx - span * 0.4, span * 0.9, cz + span * 0.6);
  sun.target.position.set(cx, 0, cz);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -span * 0.75; sc.right = sc.top = span * 0.75; sc.near = 0.1; sc.far = span * 3;
  sc.updateProjectionMatrix();

  const cam = new THREE.PerspectiveCamera(single ? 40 : 45, innerWidth / innerHeight, 0.05, 500);
  if (q.get('cam')) {
    const [px, py, pz, tx, ty, tz] = q.get('cam').split(',').map(Number);
    cam.position.set(px, py, pz); cam.lookAt(tx, ty, tz);
  } else {
    const dist = Math.max(maxX, -minZ * 1.2, maxH * 1.6) * (single ? 0.95 : 0.95) + 2;
    cam.position.set(cx, Math.max(1.6, maxH * 0.6 + dist * 0.35), 1.5 + dist * 0.75);
    cam.lookAt(cx, maxH * 0.35, cz * 0.85);
  }
  const tag = document.getElementById('tag');
  const total = stats.reduce((s, p) => s + p.tris, 0);
  tag.textContent = `${single || cat} · ${season}${month ? ' m' + month : ''} · age ${q.get('age') || 'start'} · ${stats.length} plants · ${total} △ · avg build ${(stats.reduce((s, p) => s + p.buildMs, 0) / stats.length).toFixed(1)} ms`;

  let frames = 0;
  renderer.setAnimationLoop(() => {
    renderer.render(scene, cam);
    if (++frames === 3) window.__READY = true;
  });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
  window.__clearPlantCache = clearPlantCache;
}

try { main(); } catch (e) { showErr('FATAL: ' + (e.stack || e.message)); window.__READY = true; }
void CATEGORIES;
