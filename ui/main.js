import { initTabs } from "./tabs.js";
import { initDayView } from "./dayView.js";
import { initFoodsView } from "./foodsView.js";
import { loadState, saveState, scheduleSave } from "../core/storage.js";

// Boot tabs immediately so navigation is alive even if something else fails
initTabs();

(async () => {
  // Try to load your real core modules; fall back to shims if they aren't available.
  const Core = await import("../core/index.js").catch(() => ({}));
  const StoreModule = await import("../core/store.js").catch(() => ({}));

  // --- nutrition shim (used only if Core.nutrition missing) ---
  const NutritionShim = {
    round1: (n) => Math.round((n || 0) * 10) / 10,
    kcalFromMacros: (p) => {
      const P = p?.protein || 0,
        F = p?.fat || 0,
        C = p?.carbs || 0,
        Fi = p?.fiber || 0;
      return P * 4 + F * 9 + Math.max(0, C - Fi) * 4 + Fi * 2;
    },
    scaled: (per100, amount) => ({
      kcal:
        ((per100.kcal ?? NutritionShim.kcalFromMacros(per100)) * amount) / 100,
      protein: ((per100.protein || 0) * amount) / 100,
      fat: ((per100.fat || 0) * amount) / 100,
      satFat: ((per100.satFat || 0) * amount) / 100,
      carbs: ((per100.carbs || 0) * amount) / 100,
      sugar: ((per100.sugar || 0) * amount) / 100,
      fiber: ((per100.fiber || 0) * amount) / 100,
      salt: ((per100.salt || 0) * amount) / 100,
    }),
    totals: (cards = []) =>
      cards.reduce(
        (a, c) => {
          const m = NutritionShim.scaled(c.per100 || {}, c.amount || 0);
          a.kcal += m.kcal;
          a.protein += m.protein;
          a.fat += m.fat;
          a.satFat += m.satFat;
          a.carbs += m.carbs;
          a.sugar += m.sugar;
          a.fiber += m.fiber;
          a.salt += m.salt;
          return a;
        },
        {
          kcal: 0,
          protein: 0,
          fat: 0,
          satFat: 0,
          carbs: 0,
          sugar: 0,
          fiber: 0,
          salt: 0,
        }
      ),
  };

  if (!Core.nutrition) Core.nutrition = NutritionShim;

  // --- store shim (if your real store isn't there) ---
  const defaultState = {
    targets: {
      kcal: 1810,
      protein: 50,
      fat: 70,
      satFat: 20,
      carbs: 260,
      sugar: 90,
      fiber: 30,
      salt: 6,
    },
    day: { cards: [] },
    library: { items: [] },
  };

  function makeStoreShim(initial = defaultState) {
    let state = JSON.parse(JSON.stringify(initial));
    const subs = new Set();
    return {
      get: () => state,
      subscribe: (fn) => (subs.add(fn), () => subs.delete(fn)),
      set: (updater) => {
        state = typeof updater === "function" ? updater(state) : updater;
        subs.forEach((fn) => {
          try {
            fn(state);
          } catch {}
        });
      },
      update: (patch) => {
        state = {
          ...state,
          ...(typeof patch === "function" ? patch(state) : patch),
        };
        subs.forEach((fn) => {
          try {
            fn(state);
          } catch {}
        });
      },
    };
  }

  const store =
    (StoreModule.default || StoreModule.store || null) &&
    typeof (StoreModule.default || StoreModule.store).get === "function"
      ? StoreModule.default || StoreModule.store
      : makeStoreShim();

  // Expose for any older code that reads globals
  window.Core = Core;
  window.AppStore = store;

  // ---- Restore persisted state (library, day, targets, active tab)
  const saved = loadState();

  // library + day + pot
  if (saved?.library) {
    store.set((s) => ({
      ...s,
      library: { ...(s.library || {}), items: saved.library },
    }));
  }
  if (saved?.day) {
    store.set((s) => ({ ...s, day: saved.day }));
  }
  if (saved?.pot) {
    store.set((s) => ({ ...s, pot: saved.pot }));
  }

  // daily targets (IDs from your HTML)
  const fillTarget = (key, val) => {
    const el = document.getElementById(`target-${key}`);
    if (el && (val ?? null) !== null) el.value = val;
  };
  if (saved?.targets) {
    const t = saved.targets;
    [
      "kcal",
      "protein",
      "fat",
      "satFat",
      "carbs",
      "sugar",
      "fiber",
      "salt",
    ].forEach((k) => fillTarget(k, t[k]));
  }

  // active tab (matches your buttons with data-tab="day|foods")
  if (saved?.activeTab) {
    const to = saved.activeTab;
    const btn = document.querySelector(`.tabs .tab[data-tab="${to}"]`);
    if (btn) btn.click(); // your tabs already toggle views (index header) :contentReference[oaicite:0]{index=0}
  }

  function readTargets() {
    const get = (id) =>
      Number(document.getElementById(`target-${id}`)?.value || 0);
    return {
      kcal: get("kcal"),
      protein: get("protein"),
      fat: get("fat"),
      satFat: get("satFat"),
      carbs: get("carbs"),
      sugar: get("sugar"),
      fiber: get("fiber"),
      salt: get("salt"),
    };
  }

  // save whenever app state changes
  store.subscribe(() => {
    scheduleSave(() => {
      const s = store.get();
      return {
        library: s.library?.items || [],
        day: s.day || {},
        pot: s.pot || [],
        targets: readTargets(),
        activeTab:
          document.querySelector(".tabs .tab.active")?.dataset.tab || "day",
      };
    });
  });

  const addResetBtn = document.getElementById("addToDayResetBtn");
  const addTypeSel = document.getElementById("addToDayType");
  const addCatSel = document.getElementById("addToDayCategory");
  const addSearchIn = document.getElementById("addToDaySearch");

  addResetBtn?.addEventListener("click", () => {
    if (addTypeSel) addTypeSel.value = "all";
    if (addCatSel) addCatSel.value = "all";
    if (addSearchIn) addSearchIn.value = "";

    // Trigger existing listeners so the list refreshes
    addTypeSel?.dispatchEvent(new Event("change", { bubbles: true }));
    addCatSel?.dispatchEvent(new Event("change", { bubbles: true }));
    addSearchIn?.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // also save on explicit target edits and tab clicks
  document.getElementById("targetsForm")?.addEventListener("input", () => {
    scheduleSave(() => ({ targets: readTargets() }));
  });
  document.querySelectorAll(".tabs .tab")?.forEach((btn) => {
    btn.addEventListener("click", () => {
      saveState({ activeTab: btn.dataset.tab });
    });
  });

  // Init views now that we have a store & nutrition
  initDayView(store, Core);
  initFoodsView(store, Core);
})();
