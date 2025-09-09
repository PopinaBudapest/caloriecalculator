// ui/foodsView.js
// Foods tab: Library + Cooking Pot + dialogs
// - Click anywhere on a library card to add to pot
// - Edit/Delete actions on each library card
// - No duplicate names in library (case-insensitive)
// - Smooth pot slider (preview on input, commit on change)

export function initFoodsView(store, Core) {
  // ---------- DOM ----------
  // Library
  const libGrid = document.getElementById("libraryGrid");
  const libSearch = document.getElementById("librarySearch");
  const libFilter = document.getElementById("libFilter");
  const libCatSel = document.getElementById("libCategory");
  const addBtn = document.getElementById("libAddIngredientBtn");
  const exportBtn = document.getElementById("libExportBtn");
  const importBtn = document.getElementById("libImportBtn");
  const importInput = document.getElementById("libImportInput");
  const micro = (label, val) => `<div class="lib-macro"><span>${label}</span><strong>${val}</strong></div>`;


  // Pot
  const potList = document.getElementById("potList");
  const potTotals = {
    kcal: document.getElementById("pot-kcal"),
    protein: document.getElementById("pot-protein"),
    fat: document.getElementById("pot-fat"),
    satFat: document.getElementById("pot-satfat"),
    carbs: document.getElementById("pot-carbs"),
    sugar: document.getElementById("pot-sugar"),
    fiber: document.getElementById("pot-fiber"),
    salt: document.getElementById("pot-salt"),
  };

  const saveMealBtn = document.getElementById("savePotAsMealBtn");
  const clearPotBtn = document.getElementById("clearPotBtn");

  // Add Ingredient dialog
  const addDlg = document.getElementById("ingredientDialog");
  const addForm = document.getElementById("ingredientForm");
  const addCancel = document.getElementById("cancelIngredientBtn");
  const ingKcal = document.getElementById("ingKcal");

  // Save Meal dialog
  const saveMealDlg = document.getElementById("saveMealDialog");
  const saveMealForm = document.getElementById("saveMealForm");
  const mealNameInput = document.getElementById("mealNameInput");

  // ---------- Utils ----------
  const MACROS = [
    "protein",
    "fat",
    "satFat",
    "carbs",
    "sugar",
    "fiber",
    "salt",
  ];
  const uuid = () => crypto?.randomUUID?.() || String(Date.now());

  const r1 = (n) => Math.round((n || 0) * 10) / 10;
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
  const write = (el, v) => {
    if (el) el.textContent = String(v);
  };

  const kcalFromMacros = (p) => {
    if (Core?.nutrition?.kcalFromMacros)
      return Core.nutrition.kcalFromMacros(p);
    const { protein = 0, fat = 0, carbs = 0 } = p || {};
    return protein * 4 + fat * 9 + carbs * 4;
  };

  const withKcal = (per100) => {
    const p = {
      protein: 0,
      fat: 0,
      satFat: 0,
      carbs: 0,
      sugar: 0,
      fiber: 0,
      salt: 0,
      ...(per100 || {}),
    };
    if (p.kcal == null) p.kcal = Math.round(kcalFromMacros(p));
    return p;
  };

  const scaled = (per100, amount) => {
    const p = withKcal(per100);
    const f = (amount || 0) / 100;
    const out = { kcal: p.kcal * f };
    for (const k of MACROS) out[k] = (p[k] || 0) * f;
    return out;
  };

  const nameExists = (state, name, excludeId = null) => {
    const n = String(name || "")
      .trim()
      .toLowerCase();
    return (state.library?.items || []).some(
      (x) =>
        x.id !== excludeId &&
        String(x.name || "")
          .trim()
          .toLowerCase() === n
    );
  };

  // ---------- Add / Edit Ingredient ----------
  let editingId = null; // null = create; otherwise edit that item id

  function openCreateIngredient() {
    editingId = null;
    addForm?.reset();
    addForm
      ?.querySelectorAll('input[type="number"], input[type="text"]')
      .forEach((el) => {
        el.value = "";
      });
    addForm?.querySelectorAll("select").forEach((sel) => {
      sel.selectedIndex = 0;
    });
    if (ingKcal) ingKcal.value = "";
    try {
      addDlg.showModal();
    } catch {}
  }

  function openEditIngredient(item) {
    editingId = item.id;
    addForm?.reset();
    // fill fields
    addForm.elements.name.value = item.name || "";
    addForm.elements.category.value = item.category || "other";
    addForm.elements.unit.value = item.unit || "g";
    addForm.elements.max.value = item.max ?? 1000;

    const p = withKcal(item.per100);
    addForm.elements.protein.value = p.protein || 0;
    addForm.elements.fat.value = p.fat || 0;
    addForm.elements.satFat.value = p.satFat || 0;
    addForm.elements.carbs.value = p.carbs || 0;
    addForm.elements.sugar.value = p.sugar || 0;
    addForm.elements.fiber.value = p.fiber || 0;
    addForm.elements.salt.value = p.salt || 0;
    if (ingKcal) ingKcal.value = p.kcal || 0;

    try {
      addDlg.showModal();
    } catch {}
  }

  addBtn?.addEventListener("click", openCreateIngredient);
  addCancel?.addEventListener("click", () => addDlg?.close?.());

  // live kcal compute in dialog
  addForm?.addEventListener("input", (e) => {
    if (!MACROS.includes(e.target.name)) return;
    const fd = new FormData(addForm);
    const p = {
      protein: +fd.get("protein") || 0,
      fat: +fd.get("fat") || 0,
      carbs: +fd.get("carbs") || 0,
    };
    const kcal = Math.round(kcalFromMacros(p));
    if (ingKcal) ingKcal.value = String(kcal);
  });

  // submit (create or update)
  addForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const name = String(fd.get("name") || "").trim();
    if (!name) {
      addForm.elements.name?.reportValidity?.();
      return;
    }

    const s = store.get();
    if (nameExists(s, name, editingId)) {
      // block duplicates (any type)
      addForm.elements.name?.setCustomValidity?.(
        "An item with this name already exists."
      );
      addForm.elements.name?.reportValidity?.();
      setTimeout(() => addForm.elements.name?.setCustomValidity?.(""), 0);
      return;
    }

    const base = {
      name,
      category: String(fd.get("category") || "other"),
      unit: String(fd.get("unit") || "g"),
      max: Math.max(1, parseInt(fd.get("max") || "1000", 10) || 1000),
      per100: withKcal({
        protein: +fd.get("protein") || 0,
        fat: +fd.get("fat") || 0,
        satFat: +fd.get("satFat") || 0,
        carbs: +fd.get("carbs") || 0,
        sugar: +fd.get("sugar") || 0,
        fiber: +fd.get("fiber") || 0,
        salt: +fd.get("salt") || 0,
      }),
    };

    if (!editingId) {
      const item = { id: uuid(), type: "ingredient", ...base };
      store.set((prev) => ({
        ...prev,
        library: {
          ...prev.library,
          items: [...(prev.library?.items || []), item],
        },
      }));
    } else {
      store.set((prev) => ({
        ...prev,
        library: {
          ...prev.library,
          items: (prev.library?.items || []).map((x) =>
            x.id === editingId ? { ...x, ...base } : x
          ),
        },
      }));
    }
    addDlg?.close?.();
  });

  // ---------- Library ----------
  function renderLibrary() {
  if (!libGrid) return;
  const s = store.get();
  const q   = (libSearch?.value || '').toLowerCase().trim();
  const typ = (libFilter?.value || 'all');
  const cat = (libCatSel?.value || 'all');

  const items = (s.library?.items || []).filter(x => {
    if (typ !== 'all' && x.type !== typ) return false;
    if (cat !== 'all' && x.category !== cat) return false;
    if (!q) return true;
    return String(x.name).toLowerCase().includes(q);
  });

  libGrid.innerHTML = items.map(x => {
    const p100 = withKcal(x.per100);
    const kcal100 = Math.round(p100.kcal);
    const subtitle = (x.type === 'meal')
      ? `Meal • ${(x.items?.length || 0)} item${(x.items?.length||0) === 1 ? '' : 's'}`
      : `Ingredient • ${esc(x.category || 'other')}`;

    return `
      <article class="lib-card addable" data-id="${x.id}" role="button" tabindex="0"
               title="Click to add to Cooking Pot">
        <div class="lib-actions" style="position:absolute;top:8px;right:8px;display:flex;gap:6px;">
          <button class="icon-btn edit-item" title="Edit" aria-label="Edit">✎</button>
          <button class="icon-btn delete-item" title="Delete" aria-label="Delete">🗑</button>
        </div>

        <strong>${esc(x.name)}</strong>
        <small>${subtitle}</small><br/>
        <small>Per 100 ${esc(x.unit || 'g')} — ${kcal100} kcal</small>

        <div class="lib-macros">
          ${micro('Kcal',  Math.round(p100.kcal))}
          ${micro('P',     r1(p100.protein || 0))}
          ${micro('F',     r1(p100.fat     || 0))}
          ${micro('Sat',   r1(p100.satFat  || 0))}
          ${micro('C',     r1(p100.carbs   || 0))}
          ${micro('S',     r1(p100.sugar   || 0))}
          ${micro('Fi',    r1(p100.fiber   || 0))}
          ${micro('Sa',    r1(p100.salt    || 0))}
        </div>
      </article>
    `;
  }).join('') || '<p style="opacity:.7">No items in library.</p>';
}


  libSearch?.addEventListener("input", renderLibrary);
  libFilter?.addEventListener("change", renderLibrary);
  libCatSel?.addEventListener("change", renderLibrary);

  // Delegated events on the grid:
  // 1) Click card -> add to pot
  libGrid?.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-item");
    const delBtn = e.target.closest(".delete-item");
    const card = e.target.closest(".lib-card");
    if (!card || !libGrid.contains(card)) return;

    const id = card.dataset.id;
    const s = store.get();
    const lib = s.library?.items || [];
    const item = lib.find((x) => x.id === id);
    if (!item) return;

    if (editBtn) {
      e.stopPropagation();
      if (item.type === "ingredient") {
        openEditIngredient(item);
      } else {
        // simple rename for meals
        const next = prompt("Rename meal:", item.name || "");
        if (next && !nameExists(store.get(), next, item.id)) {
          store.set((prev) => ({
            ...prev,
            library: {
              ...prev.library,
              items: (prev.library?.items || []).map((x) =>
                x.id === item.id ? { ...x, name: next } : x
              ),
            },
          }));
        } else if (next) {
          alert("An item with this name already exists.");
        }
      }
      return;
    }

    if (delBtn) {
      e.stopPropagation();
      const ok = confirm(`Delete "${item.name}"?`);
      if (!ok) return;
      store.set((prev) => ({
        ...prev,
        library: {
          ...prev.library,
          items: (prev.library?.items || []).filter((x) => x.id !== item.id),
        },
        pot: (prev.pot || []).filter((p) => p.id !== item.id), // also remove from pot if present
      }));
      return;
    }

    // default: click card -> add to pot (or +100 if already there)
    store.set((s2) => {
      const exists = (s2.pot || []).find((p) => p.id === id);
      const nextPot = exists
        ? (s2.pot || []).map((p) =>
            p.id === id
              ? { ...p, amount: Math.min((p.amount || 0) + 100, 2000) }
              : p
          )
        : [...(s2.pot || []), { id, amount: 100 }];
      return { ...s2, pot: nextPot };
    });
  });

  // keyboard support (Enter/Space on focused card)
  libGrid?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".lib-card");
    if (!card || !libGrid.contains(card)) return;
    e.preventDefault();
    const id = card.dataset.id;
    store.set((s) => {
      const exists = (s.pot || []).find((p) => p.id === id);
      const nextPot = exists
        ? (s.pot || []).map((p) =>
            p.id === id
              ? { ...p, amount: Math.min((p.amount || 0) + 100, 2000) }
              : p
          )
        : [...(s.pot || []), { id, amount: 100 }];
      return { ...s, pot: nextPot };
    });
  });

  // ---------- Pot ----------
  function macro(label, val) {
    return `<div class="macro-row"><span>${label}</span><strong>${val}</strong></div>`;
  }

  function cardMarkup(item, amount) {
    const p100 = withKcal(item.per100);
    const m = scaled(p100, amount || 0);
    return `
      <article class="food-card" data-id="${item.id}">
        <header class="food-card__head">
          <h4>${esc(item.name)}</h4>
          <button class="btn btn-ghost btn-small delete-from-pot" type="button">Delete</button>
        </header>
        <div class="food-card__meta">
          <small>Per 100 ${esc(item.unit || "g")} — ${Math.round(
      p100.kcal
    )} kcal • P ${p100.protein || 0}g • F ${p100.fat || 0}g • Sat ${
      p100.satFat || 0
    }g • C ${p100.carbs || 0}g • S ${p100.sugar || 0}g • Fiber ${
      p100.fiber || 0
    }g • Salt ${p100.salt || 0}g</small>
        </div>
        <label class="food-card__amount">Amount
          <span class="food-card__amount-val">${amount || 0} ${esc(
      item.unit || "g"
    )}</span>
          <input class="amount-slider" type="range" min="0" max="${
            item.max || 1000
          }" step="1" value="${amount || 0}">
        </label>
        <div class="food-card__grid">
          ${macro("Kcal", Math.round(m.kcal))}
          ${macro("Protein", r1(m.protein))}
          ${macro("Fat", r1(m.fat))}
          ${macro("Sat fat", r1(m.satFat))}
          ${macro("Carbs", r1(m.carbs))}
          ${macro("Sugar", r1(m.sugar))}
          ${macro("Fiber", r1(m.fiber))}
          ${macro("Salt", r1(m.salt))}
        </div>
      </article>
    `;
  }

  function renderPot() {
    if (!potList) return;
    const s = store.get();
    const lib = s.library?.items || [];
    const pot = s.pot || [];

    // cards
    potList.innerHTML = pot
      .map((p) => {
        const it = lib.find((x) => x.id === p.id);
        if (!it) return "";
        return cardMarkup(it, p.amount || 0);
      })
      .join("");

    // wire sliders + deletes
    potList.querySelectorAll(".food-card").forEach((card) => {
      const id = card.dataset.id;
      const slider = card.querySelector(".amount-slider");
      const out = card.querySelector(".food-card__amount-val");

      // Smooth: preview only on input
      slider?.addEventListener("input", () => {
        const v = Number(slider.value) || 0;
        const unit =
          (store.get().library?.items || []).find((x) => x.id === id)?.unit ||
          "g";
        if (out) out.textContent = `${v} ${unit}`;
        updatePotTotalsPreview(id, v);
      });

      // Commit on release
      slider?.addEventListener("change", () => {
        const v = Number(slider.value) || 0;
        store.set((prev) => ({
          ...prev,
          pot: (prev.pot || []).map((x) =>
            x.id === id ? { ...x, amount: v } : x
          ),
        }));
      });

      card.querySelector(".delete-from-pot")?.addEventListener("click", () => {
        store.set((prev) => ({
          ...prev,
          pot: (prev.pot || []).filter((x) => x.id !== id),
        }));
      });
    });

    // initial totals
    const totals = pot.reduce(
      (a, p) => {
        const it = lib.find((x) => x.id === p.id);
        if (!it) return a;
        const m = scaled(it.per100, p.amount || 0);
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
    );

    write(potTotals.kcal, Math.round(totals.kcal));
    write(potTotals.protein, r1(totals.protein));
    write(potTotals.fat, r1(totals.fat));
    write(potTotals.satFat, r1(totals.satFat));
    write(potTotals.carbs, r1(totals.carbs));
    write(potTotals.sugar, r1(totals.sugar));
    write(potTotals.fiber, r1(totals.fiber));
    write(potTotals.salt, r1(totals.salt));
  }

  // recompute totals without committing state (used on slider 'input')
  function updatePotTotalsPreview(overrideId, overrideAmount) {
    const s = store.get();
    const lib = s.library?.items || [];
    const pot = s.pot || [];

    const totals = pot.reduce(
      (a, p) => {
        const it = lib.find((x) => x.id === p.id);
        if (!it) return a;
        const amt = p.id === overrideId ? overrideAmount : p.amount || 0;
        const m = scaled(it.per100, amt);
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
    );

    write(potTotals.kcal, Math.round(totals.kcal));
    write(potTotals.protein, r1(totals.protein));
    write(potTotals.fat, r1(totals.fat));
    write(potTotals.satFat, r1(totals.satFat));
    write(potTotals.carbs, r1(totals.carbs));
    write(potTotals.sugar, r1(totals.sugar));
    write(potTotals.fiber, r1(totals.fiber));
    write(potTotals.salt, r1(totals.salt));
  }

  // ---------- Save meal + clear pot (duplicate-safe) ----------
  const mealExists = (state, name) => nameExists(state, name);

  function buildMeal(name, state) {
    const lib = state.library?.items || [];
    const pot = state.pot || [];
    if (!pot.length) return null;

    let totalAmt = 0;
    const totals = {
      kcal: 0,
      protein: 0,
      fat: 0,
      satFat: 0,
      carbs: 0,
      sugar: 0,
      fiber: 0,
      salt: 0,
    };
    const items = [];

    for (const p of pot) {
      const it = lib.find((x) => x.id === p.id);
      if (!it) continue;
      const amount = p.amount || 0;
      const m = scaled(it.per100, amount);
      totals.kcal += m.kcal;
      totals.protein += m.protein;
      totals.fat += m.fat;
      totals.satFat += m.satFat;
      totals.carbs += m.carbs;
      totals.sugar += m.sugar;
      totals.fiber += m.fiber;
      totals.salt += m.salt;
      totalAmt += amount;
      items.push({
        id: it.id,
        name: it.name,
        amount,
        unit: it.unit || "g",
        per100: withKcal(it.per100),
      });
    }

    const per100 = {
      kcal: 0,
      protein: 0,
      fat: 0,
      satFat: 0,
      carbs: 0,
      sugar: 0,
      fiber: 0,
      salt: 0,
    };
    if (totalAmt > 0) {
      const scale = 100 / totalAmt;
      per100.kcal = Math.round(totals.kcal * scale);
      for (const k of MACROS) per100[k] = r1(totals[k] * scale);
    }

    return {
      id: uuid(),
      type: "meal",
      name: name.trim(),
      category: "other",
      unit: "g",
      max: Math.max(100, Math.round(totalAmt)),
      per100,
      items,
    };
  }

  saveMealBtn?.addEventListener("click", () => {
    const s = store.get();
    if (!s.pot || !s.pot.length) return;
    if (mealNameInput) mealNameInput.value = "";
    try {
      saveMealDlg.showModal();
    } catch {}
  });

  // ---------- Export (pretty & simple) ----------
  exportBtn?.addEventListener("click", () => {
    const items = store.get().library?.items || [];
    const payload = {
      format: "CalorieCalculatorLibrary",
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `food_library_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // ---------- Import (silent merge; no dialogs/alerts) ----------
  importBtn?.addEventListener("click", () => importInput?.click());

  importInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Accept either {items:[...]} or a bare array
      const incoming = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : [];
      if (!incoming.length) {
        e.target.value = "";
        return;
      }

      const state = store.get();
      const existing = state.library?.items || [];
      const names = new Set(
        existing.map((x) => String(x.name).trim().toLowerCase())
      );

      const cleaned = [];
      for (const raw of incoming) {
        const it = { ...raw };

        // basic normalize
        it.name = String(it.name || "").trim();
        if (!it.name) continue;
        const key = it.name.toLowerCase();
        if (names.has(key)) continue; // skip duplicates by name (silent)

        it.type = it.type === "meal" ? "meal" : "ingredient";
        it.id = crypto?.randomUUID?.()
          ? crypto.randomUUID()
          : String(Date.now() + Math.random());
        it.category = it.category || "other";
        it.unit = it.unit || "g";
        it.max = Math.max(1, parseInt(it.max || "1000", 10) || 1000);

        // macros + kcal
        it.per100 = withKcal(it.per100 || {});
        for (const k of [
          "protein",
          "fat",
          "satFat",
          "carbs",
          "sugar",
          "fiber",
          "salt",
        ]) {
          it.per100[k] = Number.isFinite(+it.per100[k]) ? +it.per100[k] : 0;
        }

        if (it.type === "meal" && !Array.isArray(it.items)) it.items = [];

        cleaned.push(it);
        names.add(key);
      }

      if (cleaned.length) {
        store.set((prev) => ({
          ...prev,
          library: { ...prev.library, items: [...existing, ...cleaned] },
        }));
      }
    } catch {
      // silent fail (no messages requested)
      // (optionally console.warn here)
    } finally {
      // allow re-importing the same file later
      e.target.value = "";
    }
  });

  saveMealForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = String(new FormData(saveMealForm).get("name") || "").trim();
    if (!name) {
      mealNameInput?.reportValidity?.();
      return;
    }

    const s = store.get();
    if (mealExists(s, name)) {
      mealNameInput?.setCustomValidity?.(
        "An item with this name already exists."
      );
      mealNameInput?.reportValidity?.();
      setTimeout(() => mealNameInput?.setCustomValidity?.(""), 0);
      return;
    }

    const meal = buildMeal(name, s);
    if (!meal) return;

    store.set((prev) => ({
      ...prev,
      library: {
        ...prev.library,
        items: [...(prev.library?.items || []), meal],
      },
      pot: [],
    }));
    saveMealDlg?.close?.();
  });

  clearPotBtn?.addEventListener("click", () => {
    store.set((prev) => ({ ...prev, pot: [] }));
  });

  // ---------- Initial render + subscribe ----------
  function renderAll() {
    renderLibrary();
    renderPot();
  }
  renderAll();
  store.subscribe(renderAll);
}
