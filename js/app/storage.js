// localStorage wrapper: every access is guarded; the app works without it.
const KEY = 'planner.plan.v1';
export function loadSaved() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function save(plan) {
  try { localStorage.setItem(KEY, JSON.stringify(plan)); return true; } catch { return false; }
}
export function loadFlag(k) { try { return localStorage.getItem('planner.' + k); } catch { return null; } }
export function saveFlag(k, v) { try { localStorage.setItem('planner.' + k, v); } catch { /* ignore */ } }
