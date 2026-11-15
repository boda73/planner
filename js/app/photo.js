// Photo comparison: camera at the photo pose, real photo overlaid with adjustable opacity, calibration nudges.
import { SITE } from '../config/site.js';
import { poseCamera, fovToContainPhoto } from '../core/coords.js';
import { h, openDialog } from './dom.js';

export function createPhoto(app) {
  const img = document.getElementById('photo-overlay');
  const panel = document.getElementById('photo-panel');
  let cur = null; // {photo, pose, prev}
  const f1 = (v) => (+v).toFixed(2);

  function applyPose() {
    const { camera, canvas } = app;
    const p = cur.pose, ph = cur.photo;
    camera.fov = fovToContainPhoto(ph.hfov, ph.vfov, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    camera.near = 0.1; camera.far = 2500; camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.updateProjectionMatrix();
    poseCamera(camera, { X: p.X, Y: p.Y, h: p.eye, heading: p.heading, pitch: p.pitch });
    if (cur.read) cur.read.textContent = `X ${f1(p.X)}  Y ${f1(p.Y)}  h ${f1(p.eye)}  курс ${p.heading.toFixed(0)}°  нахил ${p.pitch.toFixed(0)}°`;
  }
  const nudge = (k, d) => () => {
    cur.pose[k] += d;
    if (k === 'heading') cur.pose.heading = (cur.pose.heading + 360) % 360;
    applyPose();
  };
  function build() {
    const op = h('input', { type: 'range', id: 'photo-opacity', min: 0, max: 1, step: 0.05, value: cur.opacity, 'aria-label': 'Прозорість фото',
      oninput: (e) => { cur.opacity = +e.target.value; img.style.opacity = cur.opacity; } });
    const read = h('div', { class: 'pose', id: 'photo-pose' });
    cur.read = read;
    const b = (label, k, d, title) => h('button', { class: 'btn', type: 'button', title, 'aria-label': title, onclick: nudge(k, d) }, label);
    const nud = h('div', { class: 'nudge', id: 'photo-nudge' },
      b('← 0.1 м', 'X', -0.1, 'Зсув на захід'), b('↑ 0.1 м', 'Y', 0.1, 'Зсув на північ'), b('→ 0.1 м', 'X', 0.1, 'Зсув на схід'),
      b('↓ 0.1 м', 'Y', -0.1, 'Зсув на південь'), b('вгору 5 см', 'eye', 0.05, 'Вище'), b('вниз 5 см', 'eye', -0.05, 'Нижче'),
      b('⟲ 1°', 'heading', -1, 'Повернути ліворуч'), b('нахил ↑ 1°', 'pitch', 1, 'Нахил вгору'), b('⟳ 1°', 'heading', 1, 'Повернути праворуч'),
      b('', 'pitch', 0, ''), b('нахил ↓ 1°', 'pitch', -1, 'Нахил вниз'), b('', 'pitch', 0, ''));
    nud.children[9].style.visibility = nud.children[11].style.visibility = 'hidden';
    panel.replaceChildren(
      h('div', { class: 'panel-head', style: { padding: 0, border: 0 } },
        h('span', { class: 'grow', text: cur.photo.title }),
        h('button', { class: 'btn primary small', id: 'photo-exit', type: 'button', onclick: () => app.exitPhoto() }, 'Вийти')),
      h('div', { class: 'field-label' }, h('label', { for: 'photo-opacity', text: 'Прозорість фото' }), h('span', { text: '' })),
      op,
      h('details', {}, h('summary', { text: 'Калібрування камери' }), nud, read));
    panel.hidden = false;
  }
  return {
    get active() { return !!cur; },
    get id() { return cur?.photo.id || null; },
    enter(id, opacity = 0.5) {
      const ph = SITE.photos.find((p) => p.id === id);
      if (!ph) return false;
      if (!cur) cur = { prev: app.capturePrev() };
      cur.photo = ph; cur.opacity = opacity;
      cur.pose = { X: ph.X, Y: ph.Y, eye: ph.eye, heading: ph.heading, pitch: ph.pitch };
      app.enterPhotoView();
      app.state.setYear(0);
      app.state.setTime({ month: ph.when.month, hour: ph.when.hour, day: ph.when.day });
      img.src = `./assets/photos/${ph.id}.jpg`;
      img.style.opacity = opacity; img.hidden = false;
      build(); applyPose();
      return true;
    },
    exit() {
      if (!cur) return;
      const prev = cur.prev; cur = null;
      img.hidden = true; img.removeAttribute('src'); panel.hidden = true;
      app.restorePrev(prev);
    },
    resize() { if (cur) applyPose(); },
    openPicker() {
      const dlg = openDialog({
        title: 'Порівняти з фото', id: 'photo-dialog',
        content: h('div', { class: 'photo-grid', id: 'photo-grid' }, SITE.photos.map((p) => h('button', {
          type: 'button', id: 'photo-' + p.id, onclick: () => { dlg.close(); app.enterPhoto(p.id, 0.5); },
        }, h('img', { src: `./assets/photos/${p.id}.jpg`, alt: p.title, loading: 'lazy' }), h('span', { text: p.title })))),
      });
    },
  };
}
