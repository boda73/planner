// Application orchestration: boot, views, planner API, keyboard, autosave.
import * as THREE from '../lib/three.js';
import { SITE } from '../config/site.js';
import { createRenderer } from '../core/renderer.js';
import { sunPosition, seasonOfMonth } from '../core/sun.js';
import { poseCamera } from '../core/coords.js';
import { loadCatalog, getDef } from '../items/registry.js';
import { createState, initialItems } from './state.js';
import { loadSaved, save, loadFlag } from './storage.js';
import { createItems } from './items.js';
import { createInteraction } from './interaction.js';
import { createPhoto } from './photo.js';
import { createWalk } from './views/walk.js';
import { createOrbit } from './views/orbit.js';
import { createPlan } from './views/plan.js';
import { h, closeTopDialog, dialogOpen } from './dom.js';
import { createTopbar } from './ui/topbar.js';
import { createCatalog } from './ui/catalog.js';
import { createProperties } from './ui/properties.js';
import { createDock } from './ui/dock.js';
import { createCompass, createPlanTools, createPlacementBar, showHelp } from './ui/misc.js';

const $ = (id) => document.getElementById(id);
const setLoading = (t) => { const e = $('loading-text'); if (e) e.textContent = t; };
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function startApp() {
  const q = new URLSearchParams(location.search);
  const touch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  const canvas = $('c');
  if (q.get('ui') === '0') document.body.classList.add('no-ui');

  setLoading('Створюємо сцену…');
  await tick();
  const renderer = createRenderer({ canvas, maxPixelRatio: touch ? 1.5 : 2 });
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  const persp = new THREE.PerspectiveCamera(70, 1, 0.1, 2500);

  setLoading('Завантажуємо ділянку та оточення…');
  const { createWorld } = await import('./../world/index.js');
  const world = await createWorld({ scene, renderer, camera: persp, site: SITE, assetsBase: './assets/', quality: touch ? 'low' : 'high' });
  setLoading('Завантажуємо каталог рослин і меблів…');
  await loadCatalog();

  setLoading('Розставляємо рослини…');
  const state = createState();
  const saved = loadSaved();
  if (!(saved && state.fromPlan(saved) && state.items.length)) state.setItems(initialItems(), 'load');
  state.undoStack.length = 0; state.redoStack.length = 0;
  if (q.has('year')) state.setYear(+q.get('year'));
  if (q.has('month') || q.has('hour')) state.setTime({ month: q.has('month') ? +q.get('month') : state.time.month, hour: q.has('hour') ? +q.get('hour') : state.time.hour, day: q.has('month') ? 15 : state.time.day });

  const items = createItems({ scene, state, renderer });
  const walk = createWalk({ camera: persp, canvas, uiRoot: $('ui'), world, getColliders: () => items.colliders });
  const orbit = createOrbit({ camera: persp, canvas });
  const plan = createPlan({ canvas, scene });
  const photoView = {
    name: 'photo', camera: persp, activate() {}, deactivate() {}, setInputEnabled() {}, update() {}, save() {}, restore() {},
    resize(w, hh) { persp.aspect = w / hh; persp.updateProjectionMatrix(); },
    heading() { const v = persp.getWorldDirection(new THREE.Vector3()); return (Math.atan2(v.x, -v.z) * 180 / Math.PI + 360) % 360; },
  };
  const views = { walk, orbit, plan };
  let view = walk, viewName = 'walk';
  let gridOn = false, satOn = false, labelsOn = false;

  const app = {
    canvas, renderer, scene, persp, world, state, items, views,
    get camera() { return view.camera; },
    get view() { return view; },
    get viewName() { return viewName; },
  };
  app.interaction = createInteraction(app);
  app.photo = createPhoto(app);

  // ---- UI
  const left = $('left'), dock = $('dock'), right = $('right');
  const isPhone = () => matchMedia('(max-width: 760px)').matches;
  let topbar;
  app.ui = {
    isPhone,
    toggleLeft(force) {
      const open = force ?? left.hidden;
      left.hidden = !open; document.body.classList.toggle('left-open', open);
      if (open && isPhone()) { dock.hidden = true; app.ui.closeOverflow(); }
    },
    toggleDock(force) {
      const open = force ?? dock.hidden;
      dock.hidden = !open;
      if (open && isPhone()) { app.ui.toggleLeft(false); app.ui.closeOverflow(); }
    },
    openSummary() { app.ui.toggleLeft(true); app.catalogUi.openSummary(); app.ui.closeOverflow(); },
    showHelp, closeOverflow() { topbar && topbar.closeOverflow(); },
    phoneFocus() { left.hidden = true; dock.hidden = true; document.body.classList.remove('left-open'); },
  };
  topbar = createTopbar(app);
  app.catalogUi = createCatalog(app);
  createProperties(app);
  createDock(app);
  createPlacementBar(app);
  const compass = createCompass(app);
  const planTools = createPlanTools(app);
  if (!isPhone()) { app.ui.toggleDock(true); if (innerWidth > 1100) app.ui.toggleLeft(true); }

  // ---- labels (plan view)
  const labelsEl = $('labels');
  const labelMap = new Map();
  const tmpV = new THREE.Vector3();
  function updateLabels() {
    const on = labelsOn && viewName === 'plan';
    if (!on) { if (labelMap.size) { labelsEl.replaceChildren(); labelMap.clear(); } return; }
    const w = canvas.clientWidth, hh = canvas.clientHeight, seen = new Set();
    for (const it of state.items) {
      seen.add(it.uid);
      let el = labelMap.get(it.uid);
      if (!el) { el = h('div', { class: 'item-label', text: getDef(it.id)?.name || it.id }); labelsEl.append(el); labelMap.set(it.uid, el); }
      tmpV.set(it.X, 0, -it.Y).project(view.camera);
      el.style.left = ((tmpV.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - tmpV.y) / 2 * hh) + 'px';
    }
    for (const [uid, el] of labelMap) if (!seen.has(uid)) { el.remove(); labelMap.delete(uid); }
  }

  // ---- views
  function activate(name) {
    view.deactivate();
    viewName = name;
    view = name === 'photo' ? photoView : views[name];
    document.body.classList.remove('view-walk', 'view-orbit', 'view-plan', 'view-photo');
    document.body.classList.add('view-' + name);
    view.activate();
    view.resize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
    if (name === 'plan') plan.setGrid(gridOn);
    world.setSatelliteOverlay && world.setSatelliteOverlay(name === 'plan' && satOn ? 0.6 : 0);
    planTools.show(name === 'plan');
    items.group.visible = true;
    renderer.shadowMap.needsUpdate = true;
    topbar.sync();
  }
  app.setView = (name) => {
    if (!views[name]) return;
    if (app.photo.active) app.photo.exit();
    if (name !== viewName) activate(name);
    else topbar.sync();
  };
  app.enterPhotoView = () => { if (viewName !== 'photo') activate('photo'); };
  app.capturePrev = () => ({ view: viewName, snap: view.save(), time: { ...state.time }, year: state.year });
  app.restorePrev = (p) => {
    activate(p.view);
    view.restore(p.snap);
    state.setYear(p.year); state.setTime(p.time);
    items.flush();
  };
  app.setGrid = (v) => { gridOn = v; plan.setGrid(v && viewName === 'plan'); };
  app.setSatellite = (v) => { satOn = v; world.setSatelliteOverlay && world.setSatelliteOverlay(viewName === 'plan' && v ? 0.6 : 0); };
  app.setLabels = (v) => { labelsOn = v; };

  // ---- planner API
  app.place = (id, X, Y, opts = {}) => {
    const def = getDef(id);
    if (!def) return null;
    const uid = state.add({ id, X, Y, rot: opts.rot ?? 0, age0: opts.age0 ?? (def.kind === 'plant' ? (def.startAge ?? 0) : 0) });
    items.flush();
    return uid;
  };
  app.remove = (uid) => { state.remove(uid); items.flush(); };
  app.select = (uid) => state.select(uid);
  app.duplicate = (uid) => {
    const it = state.find(uid);
    if (!it) return null;
    const n = app.place(it.id, Math.min(SITE.plot.width - 0.1, it.X + 0.6), Math.min(SITE.plot.depth - 0.1, it.Y + 0.6), { rot: it.rot, age0: it.age0 });
    state.select(n);
    return n;
  };
  app.setYear = (n) => { state.setYear(n); items.flush(); };
  app.setTime = (t) => { state.setTime(t); items.flush(); };
  app.enterPhoto = (id, op) => app.photo.enter(id, op ?? 0.5);
  app.exitPhoto = () => app.photo.exit();
  app.exportPlan = () => state.toPlan();
  app.importPlan = (p) => { const ok = state.fromPlan(p); if (ok) items.flush(); return ok; };
  app.reset = () => { app.importPlan({ version: 1, items: initialItems(), year: 0, time: { ...SITE.defaultTime } }); };
  app.project = (X, Y, hgt = 0) => {
    const v = new THREE.Vector3(X, hgt, -Y).project(view.camera), r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
  app.touch = touch;
  app.setCamera = (p) => {
    if (viewName === 'walk') walk.setPose(p);
    else if (viewName === 'orbit') {
      persp.fov = p.fov ?? 45; poseCamera(persp, { X: p.X, Y: p.Y, h: p.h ?? 1.6, heading: p.heading ?? 0, pitch: p.pitch ?? 0 });
      orbit.setFromPose(); orbit.activate();
    }
  };

  // ---- sun / season
  function applySun() {
    const t = state.time;
    world.setSeason && world.setSeason(seasonOfMonth(t.month));
    world.setSun(sunPosition({ month: t.month, day: t.day ?? 15, hour: t.hour }));
    renderer.shadowMap.needsUpdate = true;
  }
  state.on((r) => { if (r === 'time' || r === 'load') applySun(); if (r !== 'selection') topbar.sync(); });
  applySun();

  // ---- autosave
  let saveTimer = 0;
  state.on((r) => { if (r === 'selection') return; clearTimeout(saveTimer); saveTimer = setTimeout(() => save(state.toPlan()), 500); });

  // ---- keyboard
  window.addEventListener('keydown', (e) => {
    const t = e.target, tag = t && t.tagName;
    const typing = tag === 'INPUT' && !/range|checkbox|button/.test(t.type) || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'Escape') {
      if (closeTopDialog()) return;
      if (app.interaction.cancel()) return;
      state.select(null);
      return;
    }
    if (typing || dialogOpen()) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.code === 'KeyZ')) { e.preventDefault(); e.shiftKey ? state.redo() : state.undo(); return; }
    if (mod && e.code === 'KeyY') { e.preventDefault(); state.redo(); return; }
    if (mod || e.altKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { if (state.selection) { e.preventDefault(); app.remove(state.selection); } }
    else if (e.code === 'KeyR') {
      if (app.interaction.placing) app.interaction.rotateGhost();
      else if (state.selection) { const it = state.find(state.selection); state.update(it.uid, { rot: ((it.rot || 0) + 15) % 360 }); }
    }
  });

  // ---- resize / loop
  function resize() {
    const w = canvas.clientWidth || innerWidth, hh = canvas.clientHeight || innerHeight;
    renderer.setSize(w, hh, false);
    view.resize(w, hh);
    app.photo.resize();
  }
  addEventListener('resize', resize);
  resize();
  canvas.addEventListener('pointermove', (e) => { if (viewName === 'plan') planTools.readout(plan.screenToPlot(e.clientX, e.clientY)); });
  canvas.addEventListener('pointerleave', () => planTools.readout(null));

  // initial view
  const camParam = q.get('cam') ? q.get('cam').split(',').map(Number) : null;
  const startName = ['walk', 'orbit', 'plan'].includes(q.get('view')) ? q.get('view') : 'walk';
  activate(startName);
  if (camParam && camParam.length >= 2 && camParam.every(Number.isFinite)) {
    const [X, Y, hh = 1.65, heading = 0, pitch = 0, fov = 70] = camParam;
    app.setCamera({ X, Y, h: hh, heading, pitch, fov });
  }
  if (q.get('photo')) {
    const ov = q.has('overlay') ? Math.max(0, Math.min(1, +q.get('overlay'))) : 0.5;
    if (!app.photo.enter(q.get('photo'), ov)) console.warn('unknown photo', q.get('photo'));
  }
  items.flush();

  let last = performance.now(), frames = 0, raf = 0, ready = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    view.update(dt);
    world.update(dt, view.camera);
    compass.update();
    updateLabels();
    renderer.render(scene, view.camera);
    if (++frames === 4 && !ready) { ready = true; finishBoot(); }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  raf = requestAnimationFrame(frame);

  function finishBoot() {
    const ld = $('loading');
    ld.classList.add('done');
    setTimeout(() => ld.remove(), 400);
    if (!q.toString() && !loadFlag('help')) showHelp();
    window.__READY = true;
  }
  window.__app = app;
  window.__scene = scene;
}
