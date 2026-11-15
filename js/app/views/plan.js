// Plan view: orthographic top-down, north (plot +Y) up; own pan/zoom; optional 1 m grid.
import * as THREE from '../../lib/three.js';
import { SITE } from '../../config/site.js';

export function createPlan({ canvas, scene }) {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 600);
  camera.up.set(0, 0, -1);
  let cx = SITE.plot.width / 2, cy = SITE.plot.depth / 2, halfH = 15, aspect = 1, H = 1, W = 1;
  let active = false, enabled = true, fitted = false, touched = false;
  const ptrs = new Map();
  let pinch = 0;

  // grid
  const pts = [];
  for (let x = 0; x <= SITE.plot.width; x++) pts.push(x, 0.06, 0, x, 0.06, -SITE.plot.depth);
  for (let y = 0; y <= SITE.plot.depth; y++) pts.push(0, 0.06, -y, SITE.plot.width, 0.06, -y);
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const gm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
  const grid = new THREE.LineSegments(gg, gm);
  grid.visible = false; grid.renderOrder = 2;
  scene.add(grid);

  function apply() {
    halfH = THREE.MathUtils.clamp(halfH, 2, 60);
    camera.left = -halfH * aspect; camera.right = halfH * aspect; camera.top = halfH; camera.bottom = -halfH;
    camera.position.set(cx, 100, -cy);
    camera.lookAt(cx, 0, -cy);
    camera.updateProjectionMatrix();
  }
  function fit() {
    halfH = Math.max(SITE.plot.depth / 2 + 5, (SITE.plot.width / 2 + 2.5) / aspect);
    cx = SITE.plot.width / 2; cy = SITE.plot.depth / 2; apply();
  }
  const rect = () => canvas.getBoundingClientRect();
  const px2m = () => (2 * halfH) / (rect().height || 1);
  function zoomAt(clientX, clientY, f) {
    touched = true;
    const r = rect();
    const before = api.screenToPlot(clientX, clientY);
    halfH *= f; halfH = THREE.MathUtils.clamp(halfH, 2, 60);
    const m = px2m();
    cx = before.X - (clientX - r.left - r.width / 2) * m;
    cy = before.Y + (clientY - r.top - r.height / 2) * m;
    apply();
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!active || !enabled || e.button > 0) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  window.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    if (ptrs.size === 1) {
      touched = true;
      const m = px2m();
      cx -= (e.clientX - p.x) * m; cy += (e.clientY - p.y) * m; apply();
    }
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch / d);
      pinch = d;
    }
  });
  const up = (e) => { ptrs.delete(e.pointerId); pinch = 0; };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    if (!active || !enabled) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
  }, { passive: false });

  const api = {
    name: 'plan', camera, grid,
    setGrid(v) { grid.visible = v; },
    activate() { active = true; if (!fitted) { fitted = true; fit(); } else apply(); },
    deactivate() { active = false; ptrs.clear(); grid.visible = false; },
    setInputEnabled(v) { enabled = v; if (!v) ptrs.clear(); },
    resize(w, hgt) { W = w; H = hgt; aspect = w / hgt; if (touched) apply(); else fit(); },
    fit,
    heading: () => 0,
    save: () => ({ cx, cy, halfH }),
    restore(s) { cx = s.cx; cy = s.cy; halfH = s.halfH; apply(); },
    update() {},
    screenToPlot(clientX, clientY) {
      const r = rect(), m = px2m();
      return { X: cx + (clientX - r.left - r.width / 2) * m, Y: cy - (clientY - r.top - r.height / 2) * m };
    },
  };
  return api;
}
