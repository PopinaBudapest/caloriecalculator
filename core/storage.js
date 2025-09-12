// core/storage.js
export const LS_KEY = 'cc_v2_state';

export function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch (_) {
    return null;
  }
}

export function saveState(partial) {
  try {
    const cur = loadState() || { version: 1 };
    const next = { ...cur, ...partial };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch (_) {
    // ignore (quota/private mode)
  }
}

// tiny write coalescing so we don't spam storage
let _t;
export function scheduleSave(buildPartial) {
  clearTimeout(_t);
  _t = setTimeout(() => {
    const piece = buildPartial();
    if (piece) saveState(piece);
  }, 150);
}
