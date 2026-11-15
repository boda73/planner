import { h, icon, openDialog, toast } from '../dom.js';

const VIEWS = [['walk', 'Прогулянка'], ['orbit', 'Огляд'], ['plan', 'План']];

export function createTopbar(app) {
  const root = document.getElementById('topbar');
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Вигляд', id: 'view-switch' },
    VIEWS.map(([id, name]) => h('button', { type: 'button', id: 'view-' + id, 'aria-pressed': 'false', onclick: () => app.setView(id) }, name)));
  const btn = (id, ic, label, fn, extra = {}) => h('button', { class: 'btn', type: 'button', id, onclick: fn, title: label, ...extra }, icon(ic), h('span', { text: label }));

  const planMenu = h('div', { class: 'menu panel', id: 'plan-menu', hidden: true },
    h('button', { class: 'btn', type: 'button', id: 'menu-export', onclick: () => { close(); exportFile(app); } }, 'Експорт у файл'),
    h('button', { class: 'btn', type: 'button', id: 'menu-copy', onclick: () => { close(); showJson(app); } }, 'Скопіювати JSON'),
    h('button', { class: 'btn', type: 'button', id: 'menu-import', onclick: () => { close(); showImport(app); } }, 'Імпорт'),
    h('hr'),
    h('button', { class: 'btn danger', type: 'button', id: 'menu-reset', onclick: () => { close(); confirmReset(app); } }, 'Скинути до стану «як зараз»'));
  const planBtn = h('button', { class: 'btn', type: 'button', id: 'btn-plan-menu', 'aria-haspopup': 'true', 'aria-expanded': 'false',
    onclick: () => { planMenu.hidden = !planMenu.hidden; planBtn.setAttribute('aria-expanded', String(!planMenu.hidden)); } }, icon('plan'), h('span', { text: 'План' }));
  function close() { planMenu.hidden = true; planBtn.setAttribute('aria-expanded', 'false'); }

  const undo = h('button', { class: 'btn', type: 'button', id: 'btn-undo', title: 'Скасувати (Ctrl+Z)', 'aria-label': 'Скасувати', onclick: () => app.state.undo() }, icon('undo'));
  const redo = h('button', { class: 'btn', type: 'button', id: 'btn-redo', title: 'Повторити (Ctrl+Y)', 'aria-label': 'Повторити', onclick: () => app.state.redo() }, icon('redo'));
  const actions = h('div', { class: 'tb-actions', id: 'tb-actions' },
    btn('btn-catalog', 'leaf', 'Каталог', () => app.ui.toggleLeft()),
    btn('btn-photo', 'camera', 'Фото', () => { app.ui.closeOverflow(); app.photo.openPicker(); }),
    btn('btn-time', 'clock', 'Час', () => app.ui.toggleDock()),
    btn('btn-summary', 'tag', 'Список', () => app.ui.openSummary()),
    undo, redo,
    h('div', { class: 'menu-wrap' }, planBtn, planMenu),
    h('button', { class: 'btn', type: 'button', id: 'btn-help', title: 'Довідка', 'aria-label': 'Довідка', onclick: () => app.ui.showHelp() }, icon('help')));
  const more = h('button', { class: 'btn tb-more', type: 'button', id: 'btn-more', 'aria-label': 'Меню', 'aria-expanded': 'false',
    onclick: () => { const o = actions.classList.toggle('open'); more.setAttribute('aria-expanded', String(o)); } }, icon('menu'));
  root.append(h('div', { class: 'brand' }, icon('leaf'), h('span', { text: 'Планувальник ділянки' })), seg, actions, more);
  document.addEventListener('pointerdown', (e) => { if (!planMenu.hidden && !planMenu.parentElement.contains(e.target)) close(); });

  const api = {
    sync() {
      for (const [id] of VIEWS) document.getElementById('view-' + id).setAttribute('aria-pressed', String(app.viewName === id));
      undo.disabled = !app.state.undoStack.length; redo.disabled = !app.state.redoStack.length;
    },
    closeOverflow() { actions.classList.remove('open'); more.setAttribute('aria-expanded', 'false'); },
  };
  return api;
}

function jsonText(app) { return JSON.stringify(app.exportPlan(), null, 1); }

export function exportFile(app) {
  try {
    const url = URL.createObjectURL(new Blob([jsonText(app)], { type: 'application/json' }));
    const a = h('a', { href: url, download: 'plan-sadu.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Файл запропоновано до збереження. Якщо нічого не сталося — скористайтесь «Скопіювати JSON».', 3500);
  } catch { showJson(app); }
}

export function showJson(app) {
  const ta = h('textarea', { id: 'json-out', rows: 12, readOnly: true, value: jsonText(app), 'aria-label': 'JSON плану' });
  const msg = h('div', { class: 'note', id: 'json-msg', text: 'Збережіть цей текст у файл або нотатки — його можна повернути через «Імпорт».' });
  const dlg = openDialog({
    title: 'Скопіювати JSON', id: 'json-dialog', content: [msg, ta],
    buttons: [
      { id: 'json-copy', label: 'Копіювати', primary: true, keepOpen: true, onClick: () => {
        ta.focus(); ta.select();
        const fallback = () => { ta.select(); msg.textContent = 'Текст виділено — натисніть Ctrl+C.'; };
        try { navigator.clipboard.writeText(ta.value).then(() => { msg.textContent = 'Скопійовано.'; }, fallback); } catch { fallback(); }
      } },
      { label: 'Закрити' },
    ],
  });
  ta.select();
  return dlg;
}

export function showImport(app) {
  const ta = h('textarea', { id: 'json-in', rows: 10, placeholder: 'Вставте JSON плану сюди', 'aria-label': 'JSON для імпорту' });
  const file = h('input', { type: 'file', id: 'json-file', accept: '.json,application/json', 'aria-label': 'Файл плану',
    onchange: () => { const f = file.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { ta.value = String(r.result); }; r.readAsText(f); } });
  const err = h('div', { class: 'note', id: 'json-err', style: { color: 'var(--danger)' } });
  openDialog({
    title: 'Імпорт плану', id: 'import-dialog', content: [h('div', { class: 'note', text: 'Файл або вставлений текст замінить поточний план.' }), file, ta, err],
    buttons: [
      { id: 'json-apply', label: 'Застосувати', primary: true, onClick: () => {
        try { if (!app.importPlan(JSON.parse(ta.value))) throw new Error('bad'); toast('План імпортовано'); return true; }
        catch { err.textContent = 'Не вдалося прочитати план: перевірте JSON.'; return false; }
      } },
      { label: 'Скасувати' },
    ],
  });
}

export function confirmReset(app) {
  openDialog({
    title: 'Скинути план?', id: 'reset-dialog', content: h('p', { text: 'Усі ваші зміни буде втрачено, лишиться стан «як зараз».' }),
    buttons: [{ id: 'reset-ok', label: 'Скинути', danger: true, onClick: () => { app.reset(); toast('План скинуто'); } }, { label: 'Скасувати' }],
  });
}
