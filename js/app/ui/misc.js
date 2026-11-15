import { h, icon, openDialog } from '../dom.js';
import { SITE } from '../../config/site.js';
import { plotToTrueBearing, plotBounds } from '../../core/coords.js';
import { saveFlag } from '../storage.js';

export function createCompass(app) {
  const root = document.getElementById('compass');
  const ns = 'http://www.w3.org/2000/svg';
  root.innerHTML = `<svg viewBox="-32 -32 64 64" aria-label="Компас: справжня північ"><circle class="disc" r="30"/><g id="needle"><path class="north" d="M0 -26 L6 0 L-6 0z"/><path class="south" d="M0 26 L6 0 L-6 0z"/><text x="0" y="-12" text-anchor="middle" style="fill:#fff" font-size="9">Пн</text></g></svg>`;
  const needle = root.querySelector('#needle');
  let last = null;
  return {
    update() {
      const a = -(plotToTrueBearing(app.view.heading()));
      const r = Math.round(a * 2) / 2;
      if (r !== last) { last = r; needle.setAttribute('transform', `rotate(${r})`); }
    },
  };
}

export function createPlanTools(app) {
  const root = document.getElementById('plan-tools');
  const t = (id, ic, label, fn) => h('button', { class: 'btn', type: 'button', id, 'aria-pressed': 'false', title: label, onclick: (e) => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on)); fn(on); } }, icon(ic), h('span', { text: label }));
  root.append(
    t('tool-grid', 'grid', 'Сітка 1 м', (on) => app.setGrid(on)),
    t('tool-sat', 'sat', 'Супутник', (on) => app.setSatellite(on)),
    t('tool-labels', 'tag', 'Назви', (on) => app.setLabels(on)));
  const read = document.getElementById('readout');
  read.textContent = 'Наведіть курсор на ділянку';
  return {
    show(v) { root.hidden = !v; read.hidden = !v; },
    readout(p) { read.textContent = p ? `${(p.X - plotBounds().minX).toFixed(1)} м від західного паркану, ${(p.Y - plotBounds().minY).toFixed(1)} м від південного` : 'Наведіть курсор на ділянку'; },
  };
}

export function createPlacementBar(app) {
  const root = document.getElementById('placement-bar');
  const label = h('b', { id: 'placing-name' });
  const warn = h('span', { class: 'warn', id: 'placing-warn' });
  root.append(h('span', {}, 'Садимо: ', label), warn,
    h('button', { class: 'btn primary', type: 'button', id: 'placing-done', onclick: () => app.interaction.endPlacement() }, 'Готово'));
  app.interaction.onChange(() => {
    const p = app.interaction.placing;
    root.hidden = !p;
    if (p) { label.textContent = p.def.name; warn.textContent = p.warn ? '⚠ ' + p.warn : ''; }
    if (app.interaction.moving) { root.hidden = false; label.textContent = 'Перемістити: клацніть на ділянці'; warn.textContent = ''; }
  });
}

export function showHelp() {
  const rows = [
    ['Прогулянка', 'W A S D або стрілки — ходити, Shift — бігти, Q / E — повернути; перетягніть мишею, щоб дивитись. На телефоні: джойстик ліворуч і перетягування пальцем.'],
    ['Огляд', 'Ліва кнопка — обертати, права — зсув, колесо — наближення; двома пальцями на телефоні.'],
    ['План', 'Перетягування — зсув, колесо або щипок — масштаб. Вгорі праворуч: сітка, супутник, назви.'],
    ['Посадка', 'Оберіть картку в каталозі й клацайте на ділянці. Червоне коло — занадто тісно. Esc, права кнопка або «Готово» — вийти. R — повернути привид.'],
    ['Вибір', 'Клацніть на предметі: панель властивостей, перетягування по землі (в «Огляді» і «Плані»), «Перемістити», «Дублювати».'],
    ['Клавіші', 'Del — видалити, R — повернути на 15°, Ctrl+Z / Ctrl+Y — скасувати / повторити, Esc — скасувати дію.'],
    ['Час', 'Повзунок «Через ... років» показує ріст рослин; місяць і година задають сонце та сезон.'],
    ['Фото', 'Кнопка «Фото» ставить камеру в позу знімка й накладає його; повзунок — прозорість.'],
    ['Компас', 'Стрілка показує справжню північ (ділянка повернута на 10,5° за годинниковою).'],
  ];
  openDialog({ title: 'Довідка', id: 'help-dialog', content: h('dl', {}, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])),
    buttons: [{ id: 'help-close', label: 'Зрозуміло', primary: true }], onClose: () => saveFlag('help', '1') });
}
