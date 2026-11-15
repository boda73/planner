// Tiny DOM helpers, icons and dialogs (no frameworks).
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'for') el.htmlFor = v;
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

const ICONS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-13 15zM5 19l8-8"/>',
  camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h3"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  grid: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
  sat: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
  tag: '<path d="M4 4h8l8 8-8 8-8-8z"/><circle cx="8.5" cy="8.5" r="1"/>',
  plan: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'icon');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = ICONS[name] || '';
  return s;
}

const stack = [];
/** Modal dialog. buttons: [{label, primary, danger, keepOpen, onClick}] */
export function openDialog({ title, content, buttons = [{ label: 'Закрити' }], onClose, id }) {
  const root = document.getElementById('dialogs');
  const prevFocus = document.activeElement;
  const back = h('div', { class: 'backdrop' });
  const dlg = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, id });
  const api = {
    close() {
      const i = stack.indexOf(api);
      if (i < 0) return;
      stack.splice(i, 1);
      back.remove();
      try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch { /* ignore */ }
      onClose && onClose();
    },
    el: dlg,
  };
  const foot = h('div', { class: 'dfoot' }, buttons.map((b, i) => h('button', {
    class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''),
    type: 'button', id: b.id || `dlg-btn-${stack.length}-${i}`,
    onclick: () => { const r = b.onClick && b.onClick(api); if (!b.keepOpen && r !== false) api.close(); },
  }, b.label)));
  dlg.append(h('h2', { text: title }), h('div', { class: 'dbody' }, content), foot);
  back.append(dlg);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) api.close(); });
  root.append(back);
  stack.push(api);
  const first = dlg.querySelector('textarea, input, select') || foot.lastElementChild;
  try { first && first.focus(); } catch { /* ignore */ }
  return api;
}
export function closeTopDialog() { const d = stack[stack.length - 1]; if (d) { d.close(); return true; } return false; }
export function dialogOpen() { return stack.length > 0; }

let toastTimer = 0;
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
