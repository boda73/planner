import { h, icon } from '../dom.js';
import { plotBounds } from '../../core/coords.js';
import { getDef, itemSizeAt } from '../../items/registry.js';
import { sizeText } from './catalog.js';

const f1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const sz = (s) => `${f1(s.height)} × ${f1(s.width)} м`;

export function createProperties(app) {
  const root = document.getElementById('right');
  const { state } = app;
  let shownUid = null, refs = null;

  function build(it, def) {
    const plant = def.kind === 'plant';
    const r = {};
    r.title = h('div', { class: 'grow', style: { fontWeight: 600 } });
    r.badge = h('span', { class: 'badge', id: 'prop-existing', text: 'є зараз' });
    r.latin = h('div', { class: 'lt note', style: { fontStyle: 'italic' } });
    r.note = h('div', { class: 'note', id: 'prop-note' });
    r.kv = h('dl', { class: 'kv', id: 'prop-sizes' });
    r.ageVal = h('span'); r.rotVal = h('span');
    r.age = h('input', { type: 'range', id: 'prop-age', min: 0, max: 15, step: 0.5, 'aria-label': 'Вік при посадці',
      oninput: (e) => state.update(shownUid, { age0: +e.target.value }, { key: 'age' }) });
    r.rot = h('input', { type: 'range', id: 'prop-rot', min: 0, max: 359, step: 1, 'aria-label': 'Поворот',
      oninput: (e) => state.update(shownUid, { rot: +e.target.value }, { key: 'rot' }) });
    r.dist = h('dl', { class: 'kv', id: 'prop-dist' });
    r.move = h('button', { class: 'btn', type: 'button', id: 'prop-move', onclick: () => app.interaction.setMoving(!app.interaction.moving) }, icon('move'), 'Перемістити');
    root.replaceChildren(
      h('div', { class: 'panel-head' }, r.title, r.badge,
        h('button', { class: 'btn small', type: 'button', id: 'prop-close', 'aria-label': 'Закрити', onclick: () => state.select(null) }, icon('close'))),
      h('div', { class: 'panel-body' }, r.latin, r.note, r.kv,
        plant ? [h('div', { class: 'field-label' }, h('label', { for: 'prop-age', text: 'Вік при посадці' }), r.ageVal), r.age] : null,
        h('div', { class: 'field-label' }, h('label', { for: 'prop-rot', text: 'Поворот (азимут ділянки)' }), r.rotVal), r.rot,
        r.dist,
        h('div', { class: 'btn-row' }, r.move,
          h('button', { class: 'btn', type: 'button', id: 'prop-dup', onclick: () => app.duplicate(shownUid) }, icon('copy'), 'Дублювати'),
          h('button', { class: 'btn danger', type: 'button', id: 'prop-del', onclick: () => state.remove(shownUid) }, icon('trash'), 'Видалити'))));
    return r;
  }
  const kv = (box, rows) => box.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]));

  function refresh() {
    const it = state.selection && state.find(state.selection);
    root.hidden = !it;
    document.body.classList.toggle('right-open', !!it);
    if (!it) { shownUid = null; return; }
    const def = getDef(it.id);
    if (!def) return;
    if (shownUid !== it.uid || !refs || refs.id !== it.id) { shownUid = it.uid; refs = build(it, def); refs.id = it.id; if (app.ui.isPhone()) app.ui.phoneFocus('right'); }
    const r = refs, plant = def.kind === 'plant';
    r.title.textContent = def.name;
    r.badge.hidden = !it.existing;
    r.latin.textContent = def.latin || '';
    r.note.textContent = def.note || '';
    const rows = [];
    if (plant) {
      rows.push(['Зараз', sz(itemSizeAt(it.id, it.age0))]);
      if (state.year > 0) rows.push([`Через ${state.year} р.`, sz(itemSizeAt(it.id, it.age0 + state.year))]);
      rows.push(['Дорослий', sizeText(def)]);
      if (def.sun) rows.push(['Світло', { full: 'сонце', part: 'півтінь', shade: 'тінь' }[def.sun] || def.sun]);
      if (def.minSpacing) rows.push(['Відстань між', `${f1(def.minSpacing)} м`]);
    } else rows.push(['Розмір', sizeText(def)]);
    kv(r.kv, rows);
    if (plant && document.activeElement !== r.age) r.age.value = it.age0;
    if (plant) r.ageVal.textContent = `${f1(it.age0)} р.`;
    if (document.activeElement !== r.rot) r.rot.value = Math.round(((it.rot % 360) + 360) % 360);
    r.rotVal.textContent = `${Math.round(((it.rot % 360) + 360) % 360)}°`;
    kv(r.dist, [['До західного паркану', `${f1(it.X - plotBounds().minX)} м`], ['До південного', `${f1(it.Y - plotBounds().minY)} м`]]);
    r.move.setAttribute('aria-pressed', String(app.interaction.moving));
  }
  state.on((reason) => { if (reason !== 'time') refresh(); });
  app.interaction.onChange(refresh);
  refresh();
  return { refresh };
}
