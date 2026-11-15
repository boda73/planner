// Pointer interaction on the canvas: placement mode, picking, dragging, move mode, plus the selection highlight.
import * as THREE from '../lib/three.js';
import { SITE } from '../config/site.js';
import { bearingToYaw, plotBounds } from '../core/coords.js';
import { seasonOfMonth } from '../core/sun.js';
import { createItemObject, getDef, itemSizeAt } from '../items/registry.js';

function makeRing(color, opacity, fill) {
  const g = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(0.965, 1, 64);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
  const ring = new THREE.Mesh(ringGeo, mat);
  g.add(ring);
  const mats = [mat], geos = [ringGeo];
  if (fill) {
    const fg = new THREE.CircleGeometry(1, 48);
    const fm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
    g.add(new THREE.Mesh(fg, fm)); mats.push(fm); geos.push(fg);
  }
  g.rotation.x = -Math.PI / 2;
  g.traverse((o) => { o.renderOrder = 5; });
  const holder = new THREE.Group();
  holder.add(g);
  holder.userData.setColor = (c) => mats.forEach((m) => m.color.set(c));
  holder.userData.dispose = () => { mats.forEach((m) => m.dispose()); geos.forEach((x) => x.dispose()); };
  return holder;
}

export function createInteraction(app) {
  const { canvas, state, items, scene } = app;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tmp = new THREE.Vector3();
  let placing = null, moving = false, down = null, drag = null, lastPt = null;
  let placeRot = 0;
  const listeners = new Set();
  const notify = () => listeners.forEach((f) => f());

  // ---- selection highlight
  const hl = makeRing(0x3f7d3a, 0.95, true);
  hl.visible = false; scene.add(hl);
  const box = new THREE.Box3Helper(new THREE.Box3(), 0x3f7d3a);
  box.visible = false; scene.add(box);
  function refreshHighlight() {
    const it = state.selection && state.find(state.selection);
    hl.visible = box.visible = !!it;
    if (!it) return;
    const r = items.radiusOf(it);
    hl.position.set(it.X, 0.05, -it.Y); hl.scale.set(r, 1, r);
    const b = items.boundsOf(it.uid);
    if (b && !b.isEmpty()) box.box.copy(b); else box.visible = false;
  }
  items.onSynced(refreshHighlight);
  state.on((r) => { if (r === 'selection') refreshHighlight(); });

  // ---- helpers
  function setRay(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, app.camera);
  }
  function groundPoint(cx, cy) {
    setRay(cx, cy);
    const hit = ray.intersectObjects(app.world.groundMeshes, true)[0];
    let p = hit ? hit.point : ray.ray.intersectPlane(plane, tmp);
    if (!p) return null;
    return { X: p.x, Y: -p.z };
  }
  const B = plotBounds();
  const clampPlot = (p) => ({ X: Math.min(B.maxX - 0.1, Math.max(B.minX + 0.1, p.X)), Y: Math.min(B.maxY - 0.1, Math.max(B.minY + 0.1, p.Y)) });

  function conflict(def, X, Y) {
    const sp = def.minSpacing ?? def.matureWidth ?? 1;
    if (def.kind === 'plant') {
      for (const it of state.items) {
        const d = getDef(it.id);
        if (d?.kind === 'plant' && Math.hypot(it.X - X, it.Y - Y) < sp - 1e-6) return 'Занадто близько до іншої рослини';
      }
    }
    for (const c of app.world.colliders || []) {
      if (c.type === 'box' && c.h >= 0.5 && X > c.minX && X < c.maxX && Y > c.minY && Y < c.maxY) return 'Тут споруда';
    }
    return null;
  }

  // ---- placement
  function ghostify(obj) {
    const owned = [];
    const g = obj.clone(true);
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false;
      const conv = (m) => { const c = m.clone(); c.transparent = true; c.opacity = 0.55; c.depthWrite = false; owned.push(c); return c; };
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    });
    g.userData.owned = owned;
    return g;
  }
  function startPlacement(id) {
    endPlacement(false);
    const def = getDef(id);
    if (!def) return;
    state.select(null);
    moving = false;
    const season = seasonOfMonth(state.time.month);
    const age = def.kind === 'plant' ? Math.max(def.startAge ?? 0, (def.yearsToMature || 5) * 0.6) : 0;
    const ghost = ghostify(createItemObject(id, { age, season, month: state.time.month, seed: 1 }));
    const w = def.kind === 'plant' ? itemSizeAt(id, age).width : def.matureWidth;
    const f = def.footprint;
    const crownR = Math.max(0.2, f ? (f.r ?? Math.hypot(f.w, f.d) / 2) : w / 2);
    const crown = makeRing(0x3f7d3a, 0.95, true);
    const spacing = makeRing(0xe0a020, 0.8, false);
    const spR = def.kind === 'plant' ? (def.minSpacing ?? def.matureWidth ?? 1) : 0;
    crown.scale.set(crownR, 1, crownR); spacing.scale.set(spR || 0.001, 1, spR || 0.001);
    spacing.visible = spR > 0;
    const root = new THREE.Group();
    root.add(ghost, crown, spacing);
    root.visible = false;
    scene.add(root);
    placing = { id, def, root, ghost, crown, spacing, bad: null };
    placeRot = 0;
    document.body.classList.add('placing');
    notify();
  }
  function endPlacement(n = true) {
    if (!placing) return;
    scene.remove(placing.root);
    placing.ghost.userData.owned.forEach((m) => m.dispose());
    placing.crown.userData.dispose(); placing.spacing.userData.dispose();
    placing = null;
    document.body.classList.remove('placing');
    if (n) notify();
  }
  function moveGhost(p) {
    if (!placing) return;
    const c = clampPlot(p);
    placing.root.visible = true;
    placing.root.position.set(c.X, 0.04, -c.Y);
    placing.ghost.position.y = -0.04;
    placing.ghost.rotation.y = bearingToYaw(placeRot);
    placing.crown.position.y = placing.spacing.position.y = 0;
    const why = conflict(placing.def, c.X, c.Y);
    placing.bad = why;
    placing.crown.userData.setColor(why ? 0xd32f2f : 0x3f7d3a);
    placing.spacing.userData.setColor(why ? 0xd32f2f : 0xe0a020);
    placing.at = c;
    notify();
  }
  function placeHere(p) {
    const c = clampPlot(p);
    const uid = app.place(placing.id, c.X, c.Y, { rot: placeRot });
    moveGhost(c);
    return uid;
  }

  // ---- events
  const isUiTarget = (e) => e.target !== canvas;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 2) return;
    lastPt = { x: e.clientX, y: e.clientY };
    down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button, id: e.pointerId, moved: false, type: e.pointerType };
    if (e.button !== 0 || placing || moving) return;
    // start dragging the selected item directly (orbit / plan only)
    if (app.viewName === 'walk' || !state.selection) return;
    setRay(e.clientX, e.clientY);
    const hits = items.pick(ray);
    const gp = groundPoint(e.clientX, e.clientY);
    const it = state.find(state.selection);
    const near = gp && it && Math.hypot(it.X - gp.X, it.Y - gp.Y) < Math.max(0.4, items.radiusOf(it) * 0.8);
    if (hits[0] === state.selection || near) {
      drag = { uid: state.selection, started: false, off: gp ? { x: it.X - gp.X, y: it.Y - gp.Y } : { x: 0, y: 0 } };
      app.view.setInputEnabled(false);
    }
  }, { capture: true });

  window.addEventListener('pointermove', (e) => {
    if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
    if (e.target !== canvas && !drag) return;
    if (drag) {
      if (!drag.started && down?.moved) { state.checkpoint(); drag.started = true; }
      if (drag.started) {
        const gp = groundPoint(e.clientX, e.clientY);
        if (gp) { const c = clampPlot({ X: gp.X + drag.off.x, Y: gp.Y + drag.off.y }); state.update(drag.uid, c, { noUndo: true }); }
      }
      return;
    }
    if (placing) { const gp = groundPoint(e.clientX, e.clientY); if (gp) moveGhost(gp); return; }
    if (moving && state.selection && (e.pointerType === 'mouse' || down)) {
      if (e.pointerType !== 'mouse' && !down?.moved) return;
      const gp = groundPoint(e.clientX, e.clientY);
      if (gp) state.update(state.selection, clampPlot(gp), { key: 'move' });
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (drag) { drag = null; app.view.setInputEnabled(true); down = null; return; }
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    if (e.target !== canvas) return;
    const click = !d.moved && performance.now() - d.t < 700;
    if (!click) return;
    if (placing) {
      if (d.button === 2) { endPlacement(); return; }
      if (d.button === 0) { const gp = groundPoint(e.clientX, e.clientY); if (gp) placeHere(gp); }
      return;
    }
    if (d.button !== 0) return;
    if (moving) {
      const gp = groundPoint(e.clientX, e.clientY);
      if (gp && state.selection) state.update(state.selection, clampPlot(gp), { key: 'move' });
      moving = false; notify();
      return;
    }
    setRay(e.clientX, e.clientY);
    let hits = items.pick(ray);
    if (!hits.length) { const gp = groundPoint(e.clientX, e.clientY); const n = gp && items.nearest(gp.X, gp.Y); if (n) hits = [n]; }
    let uid = hits[0] || null;
    if (uid && uid === state.selection && hits[1]) uid = hits[1];
    state.select(uid);
  });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });

  const api = {
    onChange(f) { listeners.add(f); },
    startPlacement, endPlacement,
    get placing() { return placing ? { id: placing.id, def: placing.def, warn: placing.bad } : null; },
    get moving() { return moving; },
    setMoving(v) { moving = v && !!state.selection; if (moving) endPlacement(false); notify(); },
    rotateGhost() { placeRot = (placeRot + 15) % 360; if (placing?.at) moveGhost(placing.at); },
    groundPoint, setRay,
    refreshHighlight,
    cancel() {
      if (placing) { endPlacement(); return true; }
      if (moving) { moving = false; notify(); return true; }
      return false;
    },
  };
  return api;
}
