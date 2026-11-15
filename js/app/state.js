// Planner state: items, year, time, selection + undo/redo of item snapshots.
import { SITE } from '../config/site.js';
import { getDef, ageForHeight } from '../items/registry.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);

export function initialItems() {
  let n = 0;
  return SITE.existingItems.map((it, i) => {
    const def = getDef(it.id);
    return {
      uid: 'e' + (++n), id: it.id, X: it.X, Y: it.Y,
      rot: it.rot ?? Math.round(((i * 137.5) % 360) * 10) / 10,
      age0: def?.kind === 'plant' ? +ageForHeight(it.id, it.h ?? 1).toFixed(2) : 0,
      existing: true,
    };
  });
}

export function createState() {
  const listeners = new Set();
  let counter = 0;
  const s = {
    items: [], year: 0, time: { ...SITE.defaultTime }, selection: null, view: 'walk',
    undoStack: [], redoStack: [], lastKey: '', lastAt: 0,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(reason) { listeners.forEach((fn) => { try { fn(reason); } catch (e) { console.error(e); } }); },
    nextUid() { return 'p' + (++counter); },
    find(uid) { return s.items.find((i) => i.uid === uid) || null; },
    /** Push an undo snapshot; consecutive calls with the same key within 800 ms collapse. */
    checkpoint(key = '') {
      const now = performance.now();
      if (key && key === s.lastKey && now - s.lastAt < 800) { s.lastAt = now; return; }
      s.lastKey = key; s.lastAt = now;
      s.undoStack.push(clone(s.items));
      if (s.undoStack.length > 100) s.undoStack.shift();
      s.redoStack.length = 0;
    },
    setItems(items, reason = 'items') {
      s.items = items;
      counter = Math.max(counter, ...items.map((i) => +String(i.uid).replace(/\D/g, '') || 0));
      if (s.selection && !s.find(s.selection)) s.selection = null;
      s.emit(reason);
    },
    add(item, opts = {}) {
      if (!opts.noUndo) s.checkpoint();
      const it = { uid: s.nextUid(), rot: 0, age0: 0, ...item };
      s.items.push(it);
      s.emit('items');
      return it.uid;
    },
    update(uid, patch, opts = {}) {
      const it = s.find(uid);
      if (!it) return;
      if (!opts.noUndo) s.checkpoint(opts.key || '');
      Object.assign(it, patch);
      s.emit('items');
    },
    remove(uid) {
      const i = s.items.findIndex((x) => x.uid === uid);
      if (i < 0) return;
      s.checkpoint();
      s.items.splice(i, 1);
      if (s.selection === uid) s.selection = null;
      s.emit('items');
    },
    select(uid) {
      uid = uid && s.find(uid) ? uid : null;
      if (uid === s.selection) return;
      s.selection = uid;
      s.emit('selection');
    },
    undo() {
      if (!s.undoStack.length) return false;
      s.redoStack.push(clone(s.items));
      s.lastKey = '';
      s.setItems(s.undoStack.pop(), 'history');
      return true;
    },
    redo() {
      if (!s.redoStack.length) return false;
      s.undoStack.push(clone(s.items));
      s.lastKey = '';
      s.setItems(s.redoStack.pop(), 'history');
      return true;
    },
    setYear(y) { y = Math.max(0, Math.min(25, Math.round(num(y, 0)))); if (y !== s.year) { s.year = y; s.emit('year'); } },
    setTime(t) {
      const m = Math.max(1, Math.min(12, Math.round(num(t.month, s.time.month))));
      const hr = Math.max(5, Math.min(21, num(t.hour, s.time.hour)));
      const next = { month: m, hour: hr };
      if (t.day != null) next.day = t.day; else if (t.month == null && s.time.day != null) next.day = s.time.day;
      s.time = next;
      s.emit('time');
    },
    toPlan() { return { version: 1, items: clone(s.items), year: s.year, time: { ...s.time } }; },
    /** Returns true on success. Unknown species are dropped. */
    fromPlan(p) {
      if (!p || !Array.isArray(p.items)) return false;
      const items = [];
      for (const it of p.items) {
        if (!it || !getDef(it.id)) continue;
        const o = { uid: String(it.uid || ('i' + items.length)), id: it.id, X: num(it.X, 10), Y: num(it.Y, 10), rot: num(it.rot, 0), age0: Math.max(0, num(it.age0, 0)) };
        if (it.existing) o.existing = true;
        items.push(o);
      }
      s.undoStack.length = 0; s.redoStack.length = 0;
      s.year = Math.max(0, Math.min(25, Math.round(num(p.year, 0))));
      const t = p.time || {};
      s.time = { month: Math.max(1, Math.min(12, Math.round(num(t.month, SITE.defaultTime.month)))), hour: Math.max(5, Math.min(21, num(t.hour, SITE.defaultTime.hour))) };
      if (t.day != null) s.time.day = num(t.day, 15);
      s.selection = null;
      s.setItems(items, 'load');
      s.emit('year'); s.emit('time');
      return true;
    },
  };
  return s;
}
