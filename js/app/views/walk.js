// First-person walk view: WASD/arrows + drag look + touch joystick, with collisions.
import { SITE } from '../../config/site.js';
import { poseCamera } from '../../core/coords.js';
import { h } from '../dom.js';

const R = 0.25;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function pushCircle(p, cx, cy, r) {
  const dx = p.X - cx, dy = p.Y - cy, d = Math.hypot(dx, dy), m = r + R;
  if (d < m) { const k = d > 1e-6 ? m / d : 0; if (k) { p.X = cx + dx * k; p.Y = cy + dy * k; } else p.X = cx + m; }
}
function pushBox(p, x0, y0, x1, y1) {
  const cx = clamp(p.X, x0, x1), cy = clamp(p.Y, y0, y1);
  const dx = p.X - cx, dy = p.Y - cy, d = Math.hypot(dx, dy);
  if (d >= R) return;
  if (d > 1e-6) { p.X = cx + dx / d * R; p.Y = cy + dy / d * R; return; }
  const opts = [[p.X - x0, -1, 0], [x1 - p.X, 1, 0], [p.Y - y0, 0, -1], [y1 - p.Y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
  p.X += opts[1] * (opts[0] + R); p.Y += opts[2] * (opts[0] + R);
}
function pushObb(p, c) {
  const dx = p.X - c.X, dy = p.Y - c.Y;
  const lx = dx * c.rx + dy * c.ry, ly = dx * c.fx + dy * c.fy;
  const q = { X: lx, Y: ly };
  pushBox(q, -c.hw, -c.hd, c.hw, c.hd);
  if (q.X === lx && q.Y === ly) return;
  p.X = c.X + q.X * c.rx + q.Y * c.fx; p.Y = c.Y + q.X * c.ry + q.Y * c.fy;
}

export function createWalk({ camera, canvas, uiRoot, world, getColliders }) {
  const pos = { X: 16, Y: 6.5 };
  let heading = 330, pitch = 0, eye = 1.65, fov = 70, active = false, enabled = true;
  const keys = new Set();
  const joy = { x: 0, y: 0 };
  let look = null;
  const touch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;

  const stick = h('div', { class: 'joystick', id: 'joystick', hidden: true }, h('div', { class: 'knob' }));
  uiRoot.append(stick);
  const knob = stick.firstChild;
  let jid = null;
  const setJoy = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const m = r.width / 2 - 10, d = Math.hypot(dx, dy);
    if (d > m) { dx *= m / d; dy *= m / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / m; joy.y = -dy / m;
  };
  stick.addEventListener('pointerdown', (e) => { jid = e.pointerId; stick.setPointerCapture(e.pointerId); setJoy(e); e.preventDefault(); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
  const endJoy = (e) => { if (e.pointerId === jid) { jid = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
  stick.addEventListener('pointerup', endJoy); stick.addEventListener('pointercancel', endJoy);

  canvas.addEventListener('pointerdown', (e) => {
    if (!active || !enabled || e.button > 0 || look) return;
    look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', (e) => {
    if (!look || e.pointerId !== look.id) return;
    const k = e.pointerType === 'touch' ? 0.25 : 0.2;
    heading = (heading - (e.clientX - look.x) * k + 360) % 360;
    pitch = clamp(pitch - (e.clientY - look.y) * k, -85, 85);
    look.x = e.clientX; look.y = e.clientY;
  });
  const endLook = (e) => { if (look && e.pointerId === look.id) look = null; };
  window.addEventListener('pointerup', endLook); window.addEventListener('pointercancel', endLook);

  const codeKey = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', KeyQ: 'tl', KeyE: 'tr', ShiftLeft: 'run', ShiftRight: 'run' };
  window.addEventListener('keydown', (e) => {
    if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    const k = codeKey[e.code];
    if (k) { keys.add(k); if (e.code.startsWith('Arrow')) e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { const k = codeKey[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());

  function apply() {
    const gh = world?.heightAt ? world.heightAt(pos.X, pos.Y) : 0;
    poseCamera(camera, { X: pos.X, Y: pos.Y, h: eye + gh, heading, pitch });
  }
  const api = {
    name: 'walk', camera,
    get isTouch() { return touch; },
    activate() {
      active = true; camera.fov = fov; camera.near = 0.1; camera.far = 2000; camera.updateProjectionMatrix();
      stick.hidden = !touch; apply();
    },
    deactivate() { active = false; keys.clear(); look = null; stick.hidden = true; joy.x = joy.y = 0; },
    setInputEnabled(v) { enabled = v; },
    resize(w, hgt) { camera.aspect = w / hgt; camera.updateProjectionMatrix(); },
    heading: () => heading,
    getPose: () => ({ X: pos.X, Y: pos.Y, h: eye, heading, pitch, fov }),
    setPose(p) {
      if (p.X != null) pos.X = p.X; if (p.Y != null) pos.Y = p.Y;
      if (p.h != null) eye = p.h; if (p.heading != null) heading = ((p.heading % 360) + 360) % 360;
      if (p.pitch != null) pitch = clamp(p.pitch, -85, 85);
      if (p.fov != null) fov = p.fov;
      if (active) { camera.fov = fov; camera.updateProjectionMatrix(); apply(); }
    },
    save: () => api.getPose(),
    restore: (s) => api.setPose(s),
    update(dt) {
      let f = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0) + joy.y;
      let s = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + joy.x;
      if (keys.has('tl')) heading = (heading - 90 * dt + 360) % 360;
      if (keys.has('tr')) heading = (heading + 90 * dt) % 360;
      const m = Math.hypot(f, s);
      if (m > 0.01) {
        if (m > 1) { f /= m; s /= m; }
        const sp = (keys.has('run') ? 3.4 : 1.5) * dt, b = heading * Math.PI / 180;
        pos.X += (Math.sin(b) * f + Math.cos(b) * s) * sp;
        pos.Y += (Math.cos(b) * f - Math.sin(b) * s) * sp;
        for (let i = 0; i < 3; i++) {
          for (const c of world?.colliders || []) if (c.type === 'box' && c.h >= 0.4) pushBox(pos, c.minX, c.minY, c.maxX, c.maxY);
          for (const c of getColliders()) { if (c.type === 'circle') pushCircle(pos, c.X, c.Y, c.r); else pushObb(pos, c); }
          pos.X = clamp(pos.X, 0.3, SITE.plot.width - 0.3); pos.Y = clamp(pos.Y, 0.3, SITE.plot.depth - 0.3);
        }
      }
      apply();
    },
  };
  return api;
}
