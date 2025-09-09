// /core/nutrition.js
export const KCAL = { protein: 4, carbs: 4, fat: 9, alcohol: 7, fiber: 2 };

export function kcalFromMacros({ protein=0, fat=0, carbs=0, fiber=0, alcohol=0 } = {}) {
  const netCarbs = Math.max(0, carbs - fiber);
  const kcal = protein*KCAL.protein + fat*KCAL.fat + netCarbs*KCAL.carbs + fiber*KCAL.fiber + alcohol*KCAL.alcohol;
  return Math.round(kcal * 10) / 10;
}

export function scaled(per100 = {}, amount = 0) {
  const f = (amount || 0) / 100;
  const kcalBase = per100.kcal ?? kcalFromMacros(per100);
  return {
    kcal:   kcalBase * f,
    protein:(per100.protein||0) * f,
    fat:    (per100.fat||0) * f,
    satFat: (per100.satFat||0) * f,
    carbs:  (per100.carbs||0) * f,
    sugar:  (per100.sugar||0) * f,
    fiber:  (per100.fiber||0) * f,
    salt:   (per100.salt||0) * f,
  };
}

export function totals(cards = []) {
  return cards.reduce((a, c) => {
    const m = scaled(c.per100, c.amount);
    for (const k in a) a[k] += (m[k] || 0);
    return a;
  }, { kcal:0, protein:0, fat:0, satFat:0, carbs:0, sugar:0, fiber:0, salt:0 });
}

export const round1 = n => Math.round((n || 0) * 10) / 10;
export const UNITS  = { kcal:"kcal", protein:"g", fat:"g", satFat:"g", carbs:"g", sugar:"g", fiber:"g", salt:"g" };
