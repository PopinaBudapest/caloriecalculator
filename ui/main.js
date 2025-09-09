import { initTabs }      from './tabs.js';
import { initDayView }   from './dayView.js';
import { initFoodsView } from './foodsView.js';

// Boot tabs immediately so navigation is alive even if something else fails
initTabs();

(async () => {
  // Try to load your real core modules; fall back to shims if they aren't available.
  const Core = await import('../core/index.js').catch(() => ({}));
  const StoreModule = await import('../core/store.js').catch(() => ({}));

  // --- nutrition shim (used only if Core.nutrition missing) ---
  const NutritionShim = {
    round1: n => Math.round((n||0)*10)/10,
    kcalFromMacros: (p) => {
      const P=p?.protein||0, F=p?.fat||0, C=p?.carbs||0, Fi=p?.fiber||0;
      return P*4 + F*9 + Math.max(0,(C-Fi))*4 + Fi*2;
    },
    scaled: (per100, amount) => ({
      kcal:   (per100.kcal ?? NutritionShim.kcalFromMacros(per100)) * amount/100,
      protein:(per100.protein||0)*amount/100,
      fat:    (per100.fat||0)*amount/100,
      satFat: (per100.satFat||0)*amount/100,
      carbs:  (per100.carbs||0)*amount/100,
      sugar:  (per100.sugar||0)*amount/100,
      fiber:  (per100.fiber||0)*amount/100,
      salt:   (per100.salt||0)*amount/100,
    }),
    totals: (cards=[]) => cards.reduce((a,c)=>{
      const m = NutritionShim.scaled(c.per100||{}, c.amount||0);
      a.kcal+=m.kcal; a.protein+=m.protein; a.fat+=m.fat; a.satFat+=m.satFat;
      a.carbs+=m.carbs; a.sugar+=m.sugar; a.fiber+=m.fiber; a.salt+=m.salt;
      return a;
    },{kcal:0,protein:0,fat:0,satFat:0,carbs:0,sugar:0,fiber:0,salt:0})
  };

  if (!Core.nutrition) Core.nutrition = NutritionShim;

  // --- store shim (if your real store isn't there) ---
  const defaultState = {
    targets:{ kcal:1810, protein:50, fat:70, satFat:20, carbs:260, sugar:90, fiber:30, salt:6 },
    day:{ cards:[] },
    library:{ items:[] }
  };

  function makeStoreShim(initial=defaultState){
    let state = JSON.parse(JSON.stringify(initial));
    const subs = new Set();
    return {
      get: () => state,
      subscribe: fn => (subs.add(fn), () => subs.delete(fn)),
      set: updater => {
        state = typeof updater === 'function' ? updater(state) : updater;
        subs.forEach(fn => { try{ fn(state); }catch{} });
      },
      update: patch => {
        state = { ...state, ...(typeof patch==='function' ? patch(state) : patch) };
        subs.forEach(fn => { try{ fn(state); }catch{} });
      }
    };
  }

  const store =
    (StoreModule.default || StoreModule.store || null) && typeof (StoreModule.default||StoreModule.store).get === 'function'
      ? (StoreModule.default || StoreModule.store)
      : makeStoreShim();

  // Expose for any older code that reads globals
  window.Core = Core;
  window.AppStore = store;

  // Init views now that we have a store & nutrition
  initDayView(store, Core);
  initFoodsView(store, Core);
})();
