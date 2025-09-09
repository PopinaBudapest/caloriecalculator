// /core/models.js
import { kcalFromMacros } from './nutrition.js';

export const DEFAULT_TARGETS = { kcal:2000, protein:50, fat:70, satFat:20, carbs:260, sugar:90, fiber:30, salt:6 };
export const uid = () => Math.random().toString(36).slice(2,9);

export function makeIngredient(name, category, unit, per100, max = 1000) {
  const p = { protein:0, fat:0, satFat:0, carbs:0, sugar:0, fiber:0, salt:0, ...(per100 || {}) };
  const kcal = per100?.kcal ?? kcalFromMacros(p);
  return { id: uid(), kind: 'ingredient', name, category, unit, max, per100: { ...p, kcal: Math.round(kcal) } };
}

export function makeDayCardFromLibrary(libItem, category, amount = 0) {
  const per100 = { ...libItem.per100, kcal: libItem.per100?.kcal ?? Math.round(kcalFromMacros(libItem.per100)) };
  return { id: uid(), category, order: 0, name: libItem.name, unit: libItem.unit, max: libItem.max||1000, amount, per100 };
}
