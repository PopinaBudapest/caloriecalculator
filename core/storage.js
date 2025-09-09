import { DEFAULT_TARGETS } from "./models.js";

const KEYS = {
  targets: "calorie_targets_v3",
  day: "calorie_day_v3",
  library: "food_library_v2",
};

export function loadTargets() {
  try { return { ...DEFAULT_TARGETS, ...(JSON.parse(localStorage.getItem(KEYS.targets)) || {}) }; }
  catch { return { ...DEFAULT_TARGETS }; }
}
export function saveTargets(t) { localStorage.setItem(KEYS.targets, JSON.stringify(t)); }

export function loadLibrary(seedFn) {
  try {
    const s = JSON.parse(localStorage.getItem(KEYS.library));
    if (s && Array.isArray(s.items)) return s;
  } catch {}
  const seeded = seedFn();
  localStorage.setItem(KEYS.library, JSON.stringify(seeded));
  return seeded;
}
export function saveLibrary(lib) { localStorage.setItem(KEYS.library, JSON.stringify(lib)); }

export function loadDay(seedFn) {
  try {
    const s = JSON.parse(localStorage.getItem(KEYS.day));
    if (s && Array.isArray(s.cards)) return s;
  } catch {}
  const seeded = seedFn();
  localStorage.setItem(KEYS.day, JSON.stringify(seeded));
  return seeded;
}
export function saveDay(day) { localStorage.setItem(KEYS.day, JSON.stringify(day)); }
