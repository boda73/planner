// Dev harness: renders world + existing items without the app UI. Used for screenshots and photo matching.
//
// URL params (all optional):
//   photo=IMG_4010          camera = that photo's pose/FOV; sun = photo time. Add overlay=0.5 to blend the real photo.
//   cam=X,Y,h,heading,pitch,fov   free camera in plot metres / plot bearing / degrees (fov = vertical)
//   view=top | orbit        top = orthographic plan (north up), orbit = bird's-eye from the south-west (default)
//   month=7&hour=13         sun time (defaults to SITE.defaultTime, or the photo's time)
//   season=summer|autumn|spring|winter   (default derived from month)
//   year=0                  years added to every plant's age
//   items=0                 hide SITE.existingItems     world=0  skip the world module
//   only=<tag|id>           show only existing items with that tag or id
//   labels=1                print item ids at their positions (top view helper)
// Sets window.__READY = true once everything is loaded and one frame is rendered; errors go to #err.
import * as THREE from '../js/lib/three.js';
import { SITE } from '../js/config/site.js';
import { poseCamera, fovToContainPhoto, bearingToYaw, inSeason } from '../js/core/coords.js';
import { sunPosition, seasonOfMonth } from '../js/core/sun.js';
import { createRenderer } from '../js/core/renderer.js';
import { loadCatalog, createItemObject, ageForHeight, getDef } from '../js/items/registry.js';

const q = new URLSearchParams(location.search);
const errBox = document.getElementById('err');
const showErr = (m) => { errBox.textContent += m + '\n'; };
window.addEventListener('error', (e) => showErr('ERROR: ' + e.message));
window.addEventListener('unhandledrejection', (e) => showErr('REJECTION: ' + (e.reason?.message || e.reason)));
const origError = console.error;
console.error = (...a) => { showErr('console.error: ' + a.map((x) => x?.message || String(x)).join(' ')); origError(...a); };

const canvas = document.getElementById('c');
const renderer = createRenderer({ canvas });
const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);

const photo = q.get('photo') ? SITE.photos.find((p) => p.id === q.get('photo')) : null;
const when = { ...SITE.defaultTime, ...(photo?.when || {}) };
if (q.has('month')) when.month = +q.get('month');
if (q.has('day')) when.day = +q.get('day');
if (q.has('hour')) when.hour = +q.get('hour');
const season = q.get('season') || seasonOfMonth(when.month);
const year = +(q.get('year') || 0);

function setupCamera() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  renderer.setSize(w, h, false);
  const view = q.get('view');
  if (photo) {
    camera.fov = fovToContainPhoto(photo.hfov, photo.vfov, aspect);
    poseCamera(camera, { X: photo.X, Y: photo.Y, h: photo.eye, heading: photo.heading, pitch: photo.pitch });
  } else if (q.get('cam')) {
    const [X, Y, hh = 1.6, heading = 0, pitch = 0, fov = 60] = q.get('cam').split(',').map(Number);
    camera.fov = fov;
    poseCamera(camera, { X, Y, h: hh, heading, pitch });
  } else if (view === 'top') {
    const margin = +(q.get('margin') || 3);
    const halfH = SITE.plot.depth / 2 + margin;
    const halfW = Math.max(SITE.plot.width / 2 + margin, halfH * aspect);
    const hh = halfW / aspect > halfH ? halfW / aspect : halfH;
    camera = new THREE.OrthographicCamera(-hh * aspect, hh * aspect, hh, -hh, 0.1, 500);
    camera.position.set(SITE.plot.width / 2, 100, -SITE.plot.depth / 2);
    camera.up.set(0, 0, -1);
    camera.lookAt(SITE.plot.width / 2, 0, -SITE.plot.depth / 2);
  } else {
    camera.fov = 45;
    camera.position.set(-9, 20, 12);
    camera.lookAt(11, 0, -12);
  }
  if (camera.isPerspectiveCamera) camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

let loading = false;
THREE.DefaultLoadingManager.onStart = () => { loading = true; };
THREE.DefaultLoadingManager.onLoad = () => { loading = false; };
THREE.DefaultLoadingManager.onError = (url) => showErr('failed to load: ' + url);

async function main() {
  setupCamera();
  let world = null;
  if (q.get('world') !== '0') {
    const { createWorld } = await import('../js/world/index.js');
    world = await createWorld({ scene, renderer, camera, site: SITE, assetsBase: '../assets/' });
    world.setSeason?.(season);
    world.setSun(sunPosition(when));
    if (q.has('sat')) world.setSatelliteOverlay?.(+q.get('sat'));
  } else {
    scene.background = new THREE.Color(0x9fc4e8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777766, 1.2));
    const d = new THREE.DirectionalLight(0xffffff, 2);
    d.position.set(-10, 30, 10);
    scene.add(d);
  }

  if (q.get('items') !== '0') {
    await loadCatalog();
    const only = q.get('only');
    const itemsGroup = new THREE.Group();
    itemsGroup.name = 'items';
    SITE.existingItems.forEach((it, i) => {
      if (only && it.tag !== only && it.id !== only) return;
      if (!inSeason(it, when.month)) return;
      const def = getDef(it.id);
      const age = def?.kind === 'plant' ? ageForHeight(it.id, it.h ?? 1) + year : 0;
      const obj = createItemObject(it.id, { age, season, seed: i + 1 });
      obj.position.set(it.X, 0, -it.Y);
      obj.rotation.y = bearingToYaw(it.rot ?? (i * 137.5) % 360);
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      itemsGroup.add(obj);
    });
    scene.add(itemsGroup);
  }

  if (photo && q.has('overlay')) {
    const img = document.getElementById('photo');
    img.src = `../assets/photos/${photo.id}.jpg`;
    img.style.opacity = q.get('overlay');
    img.style.display = 'block';
    await img.decode().catch(() => showErr('photo not found: ' + img.src));
  }
  document.getElementById('tag').textContent =
    `${photo ? photo.id : (q.get('view') || q.get('cam') || 'orbit')} · ${when.month}/${when.day} ${when.hour}h · ${season} · +${year}y`;

  // wait until every texture requested through three's loaders has arrived (max 30 s)
  for (let t = 0; loading && t < 300; t++) await new Promise((r) => setTimeout(r, 100));
  let frames = 0;
  renderer.setAnimationLoop(() => {
    world?.update?.(0.016, camera);
    renderer.render(scene, camera);
    if (++frames === 3) window.__READY = true;
  });
  addEventListener('resize', setupCamera);
  window.__scene = scene; window.__camera = camera; window.__world = world; window.__renderer = renderer;
}

main().catch((e) => { showErr('FATAL: ' + (e.stack || e.message)); window.__READY = true; });
