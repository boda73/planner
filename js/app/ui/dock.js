import { h } from '../dom.js';

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const hh = (v) => { const H = Math.floor(v), m = Math.round((v - H) * 60); return `${H}:${String(m).padStart(2, '0')}`; };

export function createDock(app) {
  const root = document.getElementById('dock');
  const { state } = app;
  const yv = h('b', { id: 'year-val' });
  const year = h('input', { type: 'range', id: 'year-slider', min: 0, max: 25, step: 1, value: state.year, 'aria-label': 'Через скільки років', oninput: (e) => state.setYear(+e.target.value) });
  const legend = h('div', { class: 'legend', id: 'legend' });
  const month = h('select', { id: 'month-select', 'aria-label': 'Місяць', onchange: (e) => state.setTime({ month: +e.target.value, day: 15 }) },
    MONTHS.map((m, i) => h('option', { value: i + 1, text: m })));
  const hv = h('b', { id: 'hour-val' });
  const hour = h('input', { type: 'range', id: 'hour-slider', min: 5, max: 21, step: 0.25, value: state.time.hour, 'aria-label': 'Година', oninput: (e) => state.setTime({ hour: +e.target.value }) });
  root.append(
    h('div', { class: 'grp' }, h('div', { class: 'field-label' }, h('label', { for: 'year-slider', text: 'Через ... років' }), yv), year, legend),
    h('div', { class: 'grp sun' }, h('div', { class: 'field-label' }, h('label', { for: 'month-select', text: 'Сонце: місяць і година' }), hv),
      h('div', { class: 'row', style: { margin: 0 } }, month), hour));
  function refresh() {
    yv.textContent = state.year;
    year.value = state.year;
    legend.replaceChildren(h('span', {}, h('i', { style: { background: 'var(--muted)' } }), 'зараз'),
      h('span', {}, h('i', { style: { background: 'var(--accent)' } }), state.year ? `через ${state.year} р.` : 'через 0 р.'));
    month.value = state.time.month;
    hour.value = state.time.hour; hv.textContent = hh(state.time.hour);
  }
  state.on((r) => { if (r === 'year' || r === 'time' || r === 'load') refresh(); });
  refresh();
}
