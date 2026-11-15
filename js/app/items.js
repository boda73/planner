// Builds and keeps the 3D objects for state.items; derives walking colliders.
import * as THREE from '../lib/three.js';
import { bearingToYaw } from '../core/coords.js';
import { seasonOfMonth } from '../core/sun.js';
import { createItemObject, getDef, itemSizeAt } from '../items/registry.js';

function hash(s) { let x = 7; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 9973 + 1; }

export function createItems({ scene, state, renderer }) {
  const group = new THREE.Group();
  group.name = 'items';
  scene.add(group);
  const entries = new Map();
  let colliders = [];
  let timer = 0, raf = 0, dirty = true;
  const after = new Set();
  const q = (a) => Math.round(a * 4) / 4;

  const ageOf = (it) => it.age0 + state.year;
  const seasonNow = () => seasonOfMonth(state.time.month);

  function sync() {
    const season = seasonNow(), month = state.time.month;
    const seen = new Set();
    for (const it of state.items) {
      seen.add(it.uid);
      const def = getDef(it.id);
      if (!def) continue;
      const isPlant = def.kind === 'plant';
      const age = isPlant ? q(ageOf(it)) : 0;
      const key = isPlant ? `${it.id}|${age}|${season}|${month}` : it.id;
      let e = entries.get(it.uid);
      if (!e || e.key !== key) {
        if (e) group.remove(e.holder);
        const holder = new THREE.Group();
        holder.userData.uid = it.uid;
        const obj = createItemObject(it.id, { age, season, month, seed: hash(it.uid) });
        obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        holder.add(obj);
        group.add(holder);
        e = { holder, obj, key, def };
        entries.set(it.uid, e);
      }
      e.holder.position.set(it.X, 0, -it.Y);
      e.holder.rotation.y = bearingToYaw(it.rot || 0);
      e.item = it;
    }
    for (const [uid, e] of entries) if (!seen.has(uid)) { group.remove(e.holder); entries.delete(uid); }
    dirty = true;
    renderer.shadowMap.needsUpdate = true;
    after.forEach((fn) => fn());
  }

  state.on((reason) => {
    if (reason === 'year' || reason === 'time') {
      clearTimeout(timer);
      timer = setTimeout(sync, 150);
    } else if (reason === 'items' || reason === 'history' || reason === 'load') {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync(); });
    }
  });

  const api = {
    group, sync,
    flush() { clearTimeout(timer); cancelAnimationFrame(raf); raf = 0; sync(); },
    onSynced(fn) { after.add(fn); },
    entry: (uid) => entries.get(uid),
    /** Current size {height,width} of an item. */
    sizeOf(it) {
      const def = getDef(it.id);
      return def?.kind === 'plant' ? itemSizeAt(it.id, ageOf(it)) : itemSizeAt(it.id, 0);
    },
    /** Ground radius used for rings/hit tests. */
    radiusOf(it) {
      const def = getDef(it.id);
      const f = def?.footprint;
      if (f) return f.r ?? Math.hypot(f.w, f.d) / 2;
      return Math.max(0.2, api.sizeOf(it).width / 2);
    },
    /** uids hit by a raycaster, nearest first. */
    pick(raycaster) {
      const hits = raycaster.intersectObjects(group.children, true);
      const out = [];
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData.uid) o = o.parent;
        if (o && !out.includes(o.userData.uid)) out.push(o.userData.uid);
      }
      return out;
    },
    /** Nearest item to a ground point within its radius (fallback for thin things). */
    nearest(X, Y) {
      let best = null, bd = 1e9;
      for (const it of state.items) {
        const d = Math.hypot(it.X - X, it.Y - Y);
        const r = Math.max(0.35, api.radiusOf(it) * 0.8);
        if (d < r && d < bd) { bd = d; best = it.uid; }
      }
      return best;
    },
    get colliders() {
      if (!dirty) return colliders;
      dirty = false;
      colliders = [];
      for (const it of state.items) {
        const e = entries.get(it.uid);
        if (!e) continue;
        const def = e.def;
        const size = api.sizeOf(it);
        if (def.kind === 'plant') {
          if (size.height < 0.5) continue;
          const r = e.obj.userData.trunkRadius ?? Math.min(0.6, Math.max(0.1, size.width * 0.3));
          colliders.push({ type: 'circle', X: it.X, Y: it.Y, r });
        } else if (def.footprint && size.height >= 0.3) {
          const f = def.footprint;
          if (f.r) colliders.push({ type: 'circle', X: it.X, Y: it.Y, r: f.r });
          else {
            const b = (it.rot || 0) * Math.PI / 180;
            colliders.push({ type: 'obb', X: it.X, Y: it.Y, hw: f.w / 2, hd: f.d / 2, rx: Math.cos(b), ry: -Math.sin(b), fx: Math.sin(b), fy: Math.cos(b) });
          }
        }
      }
      return colliders;
    },
    boundsOf(uid) {
      const e = entries.get(uid);
      return e ? new THREE.Box3().setFromObject(e.holder) : null;
    },
  };
  return api;
}
