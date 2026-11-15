import { startApp } from './app/app.js';

startApp().catch((err) => {
  console.error(err);
  const t = document.getElementById('loading-text');
  if (t) t.textContent = 'Помилка завантаження: ' + (err && err.message ? err.message : err);
  window.__READY = true;
});
