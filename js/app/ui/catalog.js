import { h, icon } from '../dom.js';
import { CATEGORIES, listDefs } from '../../items/registry.js';

const SUN = { full: 'сонце', part: 'півтінь', shade: 'тінь' };
const f1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');

export function sizeText(def) { return `${f1(def.matureHeight)} × ${f1(def.matureWidth)} м`; }

export function createCatalog(app) {
  const root = document.getElementById('left');
  let cat = 'all', q = '';
  const search = h('input', { type: 'search', id: 'catalog-search', placeholder: 'Пошук рослин і меблів', 'aria-label': 'Пошук', oninput: (e) => { q = e.target.value.trim().toLowerCase(); render(); } });
  const chips = h('div', { class: 'chips', id: 'catalog-cats', role: 'group', 'aria-label': 'Категорії' });
  const cards = h('div', { class: 'cards', id: 'catalog-cards' });
  const summaryList = h('ul', { id: 'summary-list' });
  const summaryTotal = h('div', { class: 'note', id: 'summary-total' });
  const summary = h('details', { class: 'summary', id: 'summary' },
    h('summary', { text: 'Список посадок' }), summaryTotal, summaryList);
  root.append(
    h('div', { class: 'panel-head' }, h('span', { class: 'grow', text: 'Каталог' }),
      h('button', { class: 'btn small', type: 'button', id: 'catalog-close', 'aria-label': 'Закрити каталог', onclick: () => app.ui.toggleLeft(false) }, icon('close'))),
    h('div', { class: 'panel-body' }, search, chips, cards), summary);

  function render() {
    const defs = listDefs();
    const present = CATEGORIES.filter((c) => defs.some((d) => d.category === c.id));
    chips.replaceChildren(...[{ id: 'all', name: 'Усі' }, ...present].map((c) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(cat === c.id), id: 'cat-' + c.id, onclick: () => { cat = c.id; render(); } }, c.name)));
    const list = defs.filter((d) => (cat === 'all' || d.category === cat) &&
      (!q || `${d.name} ${d.latin || ''} ${d.id}`.toLowerCase().includes(q)));
    const placing = app.interaction.placing?.id;
    cards.replaceChildren(...list.map((d) => h('button', { class: 'card', type: 'button', id: 'card-' + d.id, 'data-id': d.id, 'aria-pressed': String(placing === d.id),
      onclick: () => { app.interaction.startPlacement(d.id); if (app.ui.isPhone()) app.ui.toggleLeft(false); } },
      h('div', { class: 'nm', text: d.name }),
      d.latin ? h('div', { class: 'lt', text: d.latin }) : null,
      h('div', { class: 'meta' },
        h('span', { class: 'tag', text: `↕ ${sizeText(d)}` }),
        d.sun ? h('span', { class: 'tag', text: SUN[d.sun] || d.sun }) : null,
        d.evergreen ? h('span', { class: 'tag', title: 'Вічнозелена', text: '● вічнозелена' }) : null))));
    if (!list.length) cards.append(h('div', { class: 'note', text: 'Нічого не знайдено' }));
  }
  function renderSummary() {
    const counts = new Map();
    for (const it of app.state.items) if (!it.existing) counts.set(it.id, (counts.get(it.id) || 0) + 1);
    const defs = new Map(listDefs().map((d) => [d.id, d]));
    const rows = [...counts].sort((a, b) => b[1] - a[1]);
    summaryList.replaceChildren(...rows.map(([id, n]) => h('li', { text: `${defs.get(id)?.name || id} — ${n} шт.` })));
    const total = rows.reduce((s, r) => s + r[1], 0);
    summaryTotal.textContent = total ? `Нових предметів: ${total}` : 'Ще нічого не заплановано';
  }
  app.state.on((r) => { if (r === 'items' || r === 'history' || r === 'load') renderSummary(); });
  app.interaction.onChange(() => {
    const id = app.interaction.placing?.id;
    cards.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.id === id)));
  });
  render(); renderSummary();
  return { render, renderSummary, openSummary() { summary.open = true; } };
}
