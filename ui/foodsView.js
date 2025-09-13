// /ui/foodsView.js
// Foods tab: Library + Cooking Pot + dialogs
// - Click anywhere on a library card to add to pot
// - Edit/Delete actions on each library card
// - No duplicate names in library (case-insensitive)
// - Smooth pot slider (preview on input, commit on change)
// - Drag & drop reordering of Food Library cards
// - MEALS: unit="piece", 1 piece = total pot weight at save time; macros are per 1 piece

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
  const micro = (label, val) =>
    `<div class="lib-macro"><span>${label}</span><strong>${val}</strong></div>`;

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

  const saveIngredientBtn = document.getElementById("savePotAsIngredientBtn"); // NEW
  const saveMealBtn = document.getElementById("savePotAsMealBtn");
  const clearPotBtn = document.getElementById("clearPotBtn");

  // Add Ingredient dialog
  const addDlg = document.getElementById("ingredientDialog");
  const addForm = document.getElementById("ingredientForm");
  const addCancel = document.getElementById("cancelIngredientBtn");
  const ingKcal = document.getElementById("ingKcal");
  if (ingKcal) {
    ingKcal.removeAttribute("readonly");
  }

  // Tracks whether user manually edited kcal (so we won't auto-overwrite)
  let kcalManual = false;

  // If the user types in kcal, treat it as manual override
  ingKcal?.addEventListener("input", () => {
    // Any keystroke toggles to manual
    kcalManual = true;
  });

  // If user clears kcal, go back to auto mode
  ingKcal?.addEventListener("change", () => {
    if (!ingKcal.value) kcalManual = false;
  });

  // Save Meal dialog
  const saveMealDlg = document.getElementById("saveMealDialog");
  const saveMealForm = document.getElementById("saveMealForm");
  const mealNameInput = document.getElementById("mealNameInput");

  // --- Helpers for "Save Ingredient from pot" ---
  const r1 = (n) => Math.round((+n || 0) * 10) / 10;

  function gramsOfItem(itemFromLib, potEntryAmount) {
    if (!itemFromLib) return 0;
    return itemFromLib.type === "meal"
      ? (itemFromLib.gramsPerPiece || 0) * (potEntryAmount || 0)
      : potEntryAmount || 0;
  }

  function scaledMacros(per100, grams) {
    const p = {
      kcal:
        per100?.kcal ??
        Math.round(
          (per100?.protein || 0) * 4 +
            (per100?.fat || 0) * 9 +
            (per100?.carbs || 0) * 4
        ),
      protein: per100?.protein || 0,
      fat: per100?.fat || 0,
      satFat: per100?.satFat || 0,
      carbs: per100?.carbs || 0,
      sugar: per100?.sugar || 0,
      fiber: per100?.fiber || 0,
      salt: per100?.salt || 0,
    };
    const f = (grams || 0) / 100;
    return {
      kcal: p.kcal * f,
      protein: p.protein * f,
      fat: p.fat * f,
      satFat: p.satFat * f,
      carbs: p.carbs * f,
      sugar: p.sugar * f,
      fiber: p.fiber * f,
      salt: p.salt * f,
    };
  }

  // Compute totals and per-100g from the pot (joins with library)
  function computePotPer100(store) {
    const s = store.get() || {};
    const pot = s.pot || [];
    const lib = s.library?.items || [];

    let totalGrams = 0;
    const sum = {
      kcal: 0,
      protein: 0,
      fat: 0,
      satFat: 0,
      carbs: 0,
      sugar: 0,
      fiber: 0,
      salt: 0,
    };

    for (const p of pot) {
      const item = lib.find((x) => x.id === p.id);
      if (!item) continue;

      const grams = gramsOfItem(item, p.amount || 0);
      totalGrams += grams;

      const m = scaledMacros(item.per100 || {}, grams);
      sum.kcal += m.kcal;
      sum.protein += m.protein;
      sum.fat += m.fat;
      sum.satFat += m.satFat;
      sum.carbs += m.carbs;
      sum.sugar += m.sugar;
      sum.fiber += m.fiber;
      sum.salt += m.salt;
    }

    if (totalGrams <= 0) return { totalGrams: 0, per100: null };

    const scale = totalGrams / 100;
    const per100 = {
      kcal: Math.round(sum.kcal / scale),
      protein: r1(sum.protein / scale),
      fat: r1(sum.fat / scale),
      satFat: r1(sum.satFat / scale),
      carbs: r1(sum.carbs / scale),
      sugar: r1(sum.sugar / scale),
      fiber: r1(sum.fiber / scale),
      salt: r1(sum.salt / scale),
    };
    return { totalGrams, per100 };
  }

  function openIngredientDialogPrefilled(per100) {
    const dlg = document.getElementById("ingredientDialog");
    const form = document.getElementById("ingredientForm");
    if (!dlg || !form || !per100) return;

    // Prefill
    form.querySelector('input[name="name"]').value = "Custom ingredient";
    form.querySelector('select[name="category"]').value = "other";
    form.querySelector('select[name="unit"]').value = "g";
    form.querySelector('input[name="max"]').value = 1000;

    // Macros per 100
    form.querySelector('input[name="protein"]').value = per100.protein;
    form.querySelector('input[name="carbs"]').value = per100.carbs;
    form.querySelector('input[name="sugar"]').value = per100.sugar;
    form.querySelector('input[name="fat"]').value = per100.fat;
    form.querySelector('input[name="satFat"]').value = per100.satFat;
    form.querySelector('input[name="fiber"]').value = per100.fiber;
    form.querySelector('input[name="salt"]').value = per100.salt;

    const kcalField = document.getElementById("ingKcal");
    if (kcalField) kcalField.value = per100.kcal;
    kcalManual = false;

    try {
      dlg.showModal();
    } catch {
      dlg.open = true;
    }
  }

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

  // Per-100 scaling (grams/ml). For meals we convert pieces->grams first.
  const scaled = (per100, amount) => {
    const p = withKcal(per100);
    const f = (amount || 0) / 100;
    const out = { kcal: p.kcal * f };
    for (const k of MACROS) out[k] = (p[k] || 0) * f;
    return out;
  };

  // When item.type === "meal": 1 piece = gramsPerPiece grams
  function scaledForItem(item, amount) {
    const p100 = withKcal(item.per100);
    if (item.type === "meal") {
      const gpp = item.gramsPerPiece || 0;
      const grams = (amount || 0) * gpp; // amount is in pieces
      return scaled(p100, grams);
    }
    // ingredients: amount already in grams/ml
    return scaled(p100, amount);
  }

  // Macro set for ONE piece of a meal (derived from per100 & gramsPerPiece)
  function perPieceMacros(meal) {
    const gpp = meal.gramsPerPiece || 0;
    if (!gpp) return null;
    return scaled(meal.per100, gpp);
  }

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

  const stepOfUnit = (u, type) =>
    type === "meal" ? 1 : u === "g" || u === "ml" ? 5 : 1;

  // ---------- Add / Edit Ingredient ----------
  let editingId = null; // null = create; otherwise edit that item id

  // Meal edit mode (pot contains this meal's items)
  let editingMealId = null;

  function openCreateIngredient() {
    kcalManual = false;
    if (ingKcal) ingKcal.value = "";

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
    kcalManual = false;

    editingId = item.id;
    addForm?.reset();
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

    if (ingKcal) ingKcal.value = p.kcal || 0; // <-- add this line

    try {
      addDlg.showModal();
    } catch {}
  }

  addBtn?.addEventListener("click", openCreateIngredient);
  addCancel?.addEventListener("click", () => addDlg?.close?.());

  function startEditMeal(meal) {
    const lib = store.get().library?.items || [];

    const potFromMeal = (meal.items || []).map((it) => {
      const libItem = lib.find((x) => x.id === it.id);
      const isMeal = (libItem?.type || it.type) === "meal";
      const libMax = libItem?.max ?? (isMeal ? 10 : 1000);
      const max = Number.isFinite(it.maxAtSave) ? it.maxAtSave : libMax; // prefer saved max

      // snap to step (5g for g/ml; 1 for piece/meal) and clamp to max
      const step =
        isMeal || (libItem?.unit || it.unit) === "piece"
          ? 1
          : (libItem?.unit || it.unit) === "g" ||
            (libItem?.unit || it.unit) === "ml"
          ? 5
          : 1;

      let amt = it.amount || 0;
      if (step > 1) amt = Math.round(amt / step) * step;
      if (amt > max) amt = max;

      return { id: it.id, amount: amt, __max: max }; // __max carried in pot ✅
    });

    editingMealId = meal.id;
    try {
      if (saveMealBtn) saveMealBtn.textContent = "Update meal";
    } catch {}
    store.set((prev) => ({ ...prev, pot: potFromMeal }));
  }

  function filterLibraryItems(
    items,
    { type = "all", category = "all", query = "" }
  ) {
    const q = String(query || "")
      .trim()
      .toLowerCase();

    // 1) If searching, ignore both type and category.
    if (q) {
      return items.filter((x) =>
        String(x.name || "")
          .toLowerCase()
          .includes(q)
      );
    }

    // 2) If a category is selected, show ALL items in that category (both types).
    if (category !== "all") {
      return items.filter((x) => x.category === category);
    }

    // 3) Otherwise, only type may restrict.
    if (type !== "all") {
      return items.filter((x) => x.type === type);
    }

    // 4) Default: everything.
    return items;
  }

  // --- replace the whole libGrid delegated click with this bound-once, capture-phase version ---
  function onLibGridClick(e) {
    const card = e.target.closest(".lib-card");
    if (!card || !libGrid.contains(card)) return;

    const editBtn = e.target.closest(".edit-item");
    const delBtn = e.target.closest(".delete-item");

    const id = card.dataset.id;
    const s = store.get();
    const lib = s.library?.items || [];
    const item = lib.find((x) => x.id === id);
    if (!item) return;

    // If we clicked an action button, prevent any other (old) listeners from firing
    if (editBtn || delBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    if (editBtn) {
      if (item.type === "ingredient") {
        openEditIngredient(item);
      } else {
        // MEAL: load back into pot for editing
        startEditMeal(item);
      }
      return;
    }

    if (delBtn) {
      const ok = confirm(`Delete "${item.name}"?`);
      if (!ok) return;
      store.set((prev) => ({
        ...prev,
        library: {
          ...prev.library,
          items: (prev.library?.items || []).filter((x) => x.id !== item.id),
        },
        pot: (prev.pot || []).filter((p) => p.id !== item.id),
      }));
      return;
    }

    // default: clicking the card adds to pot (unchanged)
    const inc = item.type === "meal" ? 1 : 100;
    store.set((s2) => {
      const exists = (s2.pot || []).find((p) => p.id === id);
      const nextPot = exists
        ? (s2.pot || []).map((p) =>
            p.id === id
              ? {
                  ...p,
                  amount: Math.min(
                    (p.amount || 0) + inc,
                    item.type === "meal" ? item.max || 10 : item.max || 1000
                  ),
                }
              : p
          )
        : [...(s2.pot || []), { id, amount: inc }];
      return { ...s2, pot: nextPot };
    });
  }

  // bind once, in CAPTURE phase so we win over any old/bubbled listeners
  function bindLibGridClickOnce() {
    if (!libGrid || libGrid.dataset.boundClick === "1") return;
    libGrid.dataset.boundClick = "1";
    libGrid.addEventListener("click", onLibGridClick, true); // <- capture
  }
  bindLibGridClickOnce();

  // live kcal compute in dialog
  addForm?.addEventListener("input", (e) => {
    // Only react to macro fields changing
    if (
      !["protein", "fat", "carbs", "satFat", "sugar", "fiber", "salt"].includes(
        e.target.name
      )
    )
      return;

    const fd = new FormData(addForm);
    const p = {
      protein: +fd.get("protein") || 0,
      fat: +fd.get("fat") || 0,
      carbs: +fd.get("carbs") || 0,
    };
    const kcal = Math.round(p.protein * 4 + p.fat * 9 + p.carbs * 4);

    if (ingKcal) ingKcal.value = String(kcal); // always overwrite on macro change
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
      addForm.elements.name?.setCustomValidity?.(
        "An item with this name already exists."
      );
      addForm.elements.name?.reportValidity?.();
      setTimeout(() => addForm.elements.name?.setCustomValidity?.(""), 0);
      return;
    }

    const kcalInput = fd.get("kcal");
    const per100Raw = {
      protein: +fd.get("protein") || 0,
      fat: +fd.get("fat") || 0,
      satFat: +fd.get("satFat") || 0,
      carbs: +fd.get("carbs") || 0,
      sugar: +fd.get("sugar") || 0,
      fiber: +fd.get("fiber") || 0,
      salt: +fd.get("salt") || 0,
      kcal: Number.isFinite(+kcalInput) ? Math.round(+kcalInput) : undefined, // keep manual value if provided
    };

    const base = {
      name,
      category: String(fd.get("category") || "other"),
      unit: String(fd.get("unit") || "g"),
      max: Math.max(1, parseInt(fd.get("max") || "1000", 10) || 1000),
      per100: withKcal(per100Raw), // fills kcal if undefined
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

  // ---------- Drag & drop reordering for the Food Library ----------
  function initLibraryReorder(store) {
    const grid =
      libGrid ||
      document.getElementById("libraryGrid") ||
      document.querySelector(".library-grid");
    if (!grid) return;

    let dragId = null;
    let justDroppedAt = 0;

    function bindDraggables() {
      grid.querySelectorAll(".lib-card").forEach((card) => {
        if (card.dataset.dndBound === "1") return;
        card.dataset.dndBound = "1";
        card.setAttribute("draggable", "true");

        card.addEventListener("dragstart", (e) => {
          const id = card.dataset.id;
          if (!id) return e.preventDefault();
          dragId = id;
          e.dataTransfer?.setData("text/plain", id);
          e.dataTransfer?.setDragImage?.(card, card.clientWidth / 2, 16);
          requestAnimationFrame(() => card.classList.add("dragging"));
        });

        card.addEventListener("dragend", () => {
          card.classList.remove("dragging");
          clearIndicators();
          dragId = null;
        });
      });
    }

    function clearIndicators() {
      grid
        .querySelectorAll(".lib-card.drop-before, .lib-card.drop-after")
        .forEach((el) => el.classList.remove("drop-before", "drop-after"));
    }
    function showIndicator(target, where) {
      clearIndicators();
      if (!target) return;
      target.classList.add(where === "before" ? "drop-before" : "drop-after");
    }

    grid.addEventListener("dragover", (e) => {
      if (!dragId) return;
      e.preventDefault(); // allow drop

      const target = e.target.closest(".lib-card");
      if (!target || target.dataset.id === dragId) {
        clearIndicators();
        return;
      }

      const r = target.getBoundingClientRect();
      const before = e.clientX < r.left + r.width / 2; // LEFT/RIGHT split
      showIndicator(target, before ? "before" : "after");
    });

    grid.addEventListener("drop", (e) => {
      if (!dragId) return;
      e.preventDefault();

      const target = e.target.closest(".lib-card");
      if (!target || !target.dataset.id || target.dataset.id === dragId) {
        clearIndicators();
        return;
      }

      const r = target.getBoundingClientRect();
      const before = e.clientX < r.left + r.width / 2; // LEFT/RIGHT split
      applyReorder(dragId, target.dataset.id, before);
      clearIndicators();
      justDroppedAt = performance.now();
    });

    // Suppress click right after drop (avoid accidental "add to pot")
    grid.addEventListener(
      "click",
      (e) => {
        if (performance.now() - justDroppedAt < 200) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );

    function applyReorder(srcId, destId, before) {
      const s = store.get();
      const list = Array.from(s.library?.items || []);
      const from = list.findIndex((x) => x.id === srcId);
      if (from === -1) return;
      const [moved] = list.splice(from, 1);

      let to = list.findIndex((x) => x.id === destId);
      if (to === -1) list.push(moved);
      else {
        if (!before) to += 1;
        list.splice(to, 0, moved);
      }

      store.set((prev) => ({
        ...prev,
        library: { ...(prev.library || {}), items: list },
      }));
    }

    // Re-bind after each render
    const mo = new MutationObserver(() => bindDraggables());
    mo.observe(grid, { childList: true, subtree: true });
    bindDraggables();
  }

  // ---------- Library ----------
  function renderLibrary() {
    if (!libGrid) return;
    const s = store.get();
    const q = libSearch?.value || "";
    const typ = libFilter?.value || "all";
    const cat = libCatSel?.value || "all";

    const allItems = s.library?.items || [];
    const items = filterLibraryItems(allItems, {
      type: typ,
      category: cat,
      query: q,
    });

    libGrid.innerHTML =
      items
        .map((x) => {
          const isMeal = x.type === "meal";
          const p100 = withKcal(x.per100);
          const piece = isMeal ? perPieceMacros(x) : null;
          const kcalLine = isMeal
            ? `Per 1 piece${
                x.gramsPerPiece ? ` (${Math.round(x.gramsPerPiece)} g)` : ""
              } — ${Math.round(piece?.kcal || 0)} kcal`
            : `Per 100 ${esc(x.unit || "g")} — ${Math.round(p100.kcal)} kcal`;

          return `
          <article class="lib-card addable" data-id="${
            x.id
          }" role="button" tabindex="0" title="Click to add to Cooking Pot">
            <div class="lib-actions" style="position:absolute;top:8px;right:8px;display:flex;gap:6px;">
              <button class="icon-btn edit-item" title="Edit" aria-label="Edit">✎</button>
              <button class="icon-btn delete-item" title="Delete" aria-label="Delete">🗑</button>
            </div>

            <strong>${esc(x.name)}</strong>
            <small>${
              isMeal
                ? `Meal • ${x.items?.length || 0} item${
                    (x.items?.length || 0) === 1 ? "" : "s"
                  }`
                : `Ingredient • ${esc(x.category || "other")}`
            }</small><br/>
            <small>${kcalLine}</small>

            <div class="lib-macros">
              ${micro("Kc", Math.round(isMeal ? piece?.kcal || 0 : p100.kcal))}
              ${micro(
                "P",
                r1(isMeal ? piece?.protein || 0 : p100.protein || 0)
              )}
              ${micro("F", r1(isMeal ? piece?.fat || 0 : p100.fat || 0))}
              ${micro("Sf", r1(isMeal ? piece?.satFat || 0 : p100.satFat || 0))}
              ${micro("C", r1(isMeal ? piece?.carbs || 0 : p100.carbs || 0))}
              ${micro("S", r1(isMeal ? piece?.sugar || 0 : p100.sugar || 0))}
              ${micro("Fi", r1(isMeal ? piece?.fiber || 0 : p100.fiber || 0))}
              ${micro("Sa", r1(isMeal ? piece?.salt || 0 : p100.salt || 0))}
            </div>
          </article>
        `;
        })
        .join("") || '<p style="opacity:.7">No items in library.</p>';
  }

  libSearch?.addEventListener("input", renderLibrary);
  libFilter?.addEventListener("change", renderLibrary);
  libCatSel?.addEventListener("change", renderLibrary);

  // keyboard support (Enter/Space on focused card)
  libGrid?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".lib-card");
    if (!card || !libGrid.contains(card)) return;
    e.preventDefault();
    const id = card.dataset.id;
    const item = (store.get().library?.items || []).find((x) => x.id === id);
    const inc = item?.type === "meal" ? 1 : 100;
    store.set((s) => {
      const exists = (s.pot || []).find((p) => p.id === id);
      const nextPot = exists
        ? (s.pot || []).map((p) =>
            p.id === id
              ? {
                  ...p,
                  amount: Math.min(
                    (p.amount || 0) + inc,
                    item?.type === "meal" ? item?.max || 10 : item?.max || 1000
                  ),
                }
              : p
          )
        : [...(s.pot || []), { id, amount: inc }];
      return { ...s, pot: nextPot };
    });
  });

  // ---------- Pot ----------
  function macro(label, val) {
    return `<div class="macro-row"><span>${label}</span><strong>${val}</strong></div>`;
  }

  function cardMarkup(item, potEntry) {
    const isMeal = item.type === "meal";
    const amount = potEntry?.amount || 0;
    const max = potEntry?.__max ?? (isMeal ? item.max || 10 : item.max || 1000);
    const step = stepOfUnit(item.unit || (isMeal ? "piece" : "g"), item.type);
    const safeAmount = Math.min(amount, max);

    const m = scaledForItem(item, safeAmount);
    const displayUnit = isMeal ? "piece" : item.unit || "g";

    // meta line
    let metaLine = "";
    if (isMeal) {
      const one = perPieceMacros(item) || {
        kcal: 0,
        protein: 0,
        fat: 0,
        satFat: 0,
        carbs: 0,
        sugar: 0,
        fiber: 0,
        salt: 0,
      };
      metaLine =
        `Per 1 piece${
          item.gramsPerPiece ? ` (${Math.round(item.gramsPerPiece)} g)` : ""
        } — ` +
        `${Math.round(one.kcal)} kcal • P ${r1(one.protein)}g • F ${r1(
          one.fat
        )}g • ` +
        `Sat ${r1(one.satFat)}g • C ${r1(one.carbs)}g • S ${r1(
          one.sugar
        )}g • ` +
        `Fiber ${r1(one.fiber)}g • Salt ${r1(one.salt)}g`;
    } else {
      const p100 = withKcal(item.per100);
      metaLine =
        `Per 100 ${esc(item.unit || "g")} — ${Math.round(p100.kcal)} kcal • ` +
        `P ${p100.protein || 0}g • F ${p100.fat || 0}g • Sat ${
          p100.satFat || 0
        }g • ` +
        `C ${p100.carbs || 0}g • S ${p100.sugar || 0}g • Fiber ${
          p100.fiber || 0
        }g • ` +
        `Salt ${p100.salt || 0}g`;
    }

    return `
    <article class="food-card" data-id="${item.id}">
      <header class="food-card__head">
        <h4>${esc(item.name)}</h4>
        <button class="btn btn-ghost btn-small delete-from-pot" type="button">Delete</button>
      </header>
      <div class="food-card__meta"><small>${metaLine}</small></div>
      <label class="food-card__amount">Amount
        <span class="food-card__amount-val">${safeAmount} ${esc(
      displayUnit
    )}</span>
        <input class="amount-slider" type="range" min="0" max="${max}" step="${step}" value="${safeAmount}">
      </label>
      <div class="food-card__grid">
        ${macro("Kc", Math.round(m.kcal))}
        ${macro("P", r1(m.protein))}
        ${macro("F", r1(m.fat))}
        ${macro("Sf", r1(m.satFat))}
        ${macro("C", r1(m.carbs))}
        ${macro("S", r1(m.sugar))}
        ${macro("Fi", r1(m.fiber))}
        ${macro("Sa", r1(m.salt))}
      </div>
    </article>
  `;
  }

  function renderPot() {
    if (!potList) return;
    const s = store.get();
    const lib = s.library?.items || [];
    const pot = s.pot || [];

    potList.innerHTML = pot
      .map((p) => {
        const it = lib.find((x) => x.id === p.id);
        if (!it) return "";
        return cardMarkup(it, p);
      })
      .join("");

    // wire sliders + deletes
    potList.querySelectorAll(".food-card").forEach((card) => {
      const id = card.dataset.id;
      const slider = card.querySelector(".amount-slider");
      const out = card.querySelector(".food-card__amount-val");

      slider?.addEventListener("input", () => {
        const v = Number(slider.value) || 0;
        const item = (store.get().library?.items || []).find(
          (x) => x.id === id
        );
        const unit = item?.type === "meal" ? "piece" : item?.unit || "g";
        if (out) out.textContent = `${v} ${unit}`;
        updatePotTotalsPreview(id, v);
      });

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
        const m = scaledForItem(it, p.amount || 0);
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
        const m = scaledForItem(it, amt);
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

  // ---------- Save Ingredient (NEW) ----------
  saveIngredientBtn?.addEventListener("click", () => {
    const { totalGrams, per100 } = computePotPer100(store);
    if (!per100 || totalGrams <= 0) {
      alert("Cooking Pot is empty (or 0 g). Add some items first.");
      return;
    }
    openIngredientDialogPrefilled(per100);
  });

  // ---------- Save meal + clear pot ----------
  const mealExists = (state, name, excludeId = null) =>
    nameExists(state, name, excludeId);

  function buildMeal(name, state) {
    const lib = state.library?.items || [];
    const pot = state.pot || [];
    if (!pot.length) return null;

    let totalAmt = 0; // grams/ml total weight of pot
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
      const m = scaledForItem(it, amount);
      totals.kcal += m.kcal;
      totals.protein += m.protein;
      totals.fat += m.fat;
      totals.satFat += m.satFat;
      totals.carbs += m.carbs;
      totals.sugar += m.sugar;
      totals.fiber += m.fiber;
      totals.salt += m.salt;

      const weight =
        it.type === "meal"
          ? (it.gramsPerPiece || 0) * amount // amount = pieces
          : amount; // grams/ml
      totalAmt += weight;

      items.push({
        id: it.id,
        name: it.name,
        amount,
        unit: it.type === "meal" ? "piece" : it.unit || "g",
        per100: withKcal(it.per100),
        type: it.type,
        gramsPerPiece: it.gramsPerPiece || undefined,
        maxAtSave: it.max ?? (it.type === "meal" ? 10 : 1000),
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
      unit: "piece",
      gramsPerPiece: Math.round(totalAmt),
      max: 10,
      per100,
      items,
    };
  }

  saveMealBtn?.addEventListener("click", () => {
    const s = store.get();
    if (!s.pot || !s.pot.length) return;
    if (mealNameInput) {
      const cur = (s.library?.items || []).find((x) => x.id === editingMealId);
      mealNameInput.value = cur?.name || "";
    }
    try {
      saveMealDlg.showModal();
    } catch {}
  });

  saveMealForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = String(new FormData(saveMealForm).get("name") || "").trim();
    if (!name) {
      mealNameInput?.reportValidity?.();
      return;
    }

    const s = store.get();
    if (mealExists(s, name, editingMealId)) {
      mealNameInput?.setCustomValidity?.(
        "An item with this name already exists."
      );
      mealNameInput?.reportValidity?.();
      setTimeout(() => mealNameInput?.setCustomValidity?.(""), 0);
      return;
    }

    const built = buildMeal(name, s);
    if (!built) return;

    if (editingMealId) {
      // UPDATE existing meal in place (keep same id)
      const updated = { ...built, id: editingMealId };
      store.set((prev) => ({
        ...prev,
        library: {
          ...prev.library,
          items: (prev.library?.items || []).map((x) =>
            x.id === editingMealId ? updated : x
          ),
        },
        pot: [], // clear pot after update
      }));
    } else {
      // CREATE new meal
      store.set((prev) => ({
        ...prev,
        library: {
          ...prev.library,
          items: [...(prev.library?.items || []), built],
        },
        pot: [],
      }));
    }

    // reset edit mode + UI
    editingMealId = null;
    try {
      if (saveMealBtn) saveMealBtn.textContent = "Save as Meal";
    } catch {}
    saveMealDlg?.close?.();
  });

  clearPotBtn?.addEventListener("click", () => {
    editingMealId = null;
    try {
      if (saveMealBtn) saveMealBtn.textContent = "Save as Meal";
    } catch {}
    store.set((prev) => ({ ...prev, pot: [] }));
  });

  // ---------- Export / Import ----------
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

  importBtn?.addEventListener("click", () => importInput?.click());

  // Import: silent merge, skip duplicate names (case-insensitive)
  importInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Accept either { items: [...] } or a bare array
      const incoming = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : [];

      if (!incoming.length) {
        e.target.value = ""; // allow same file again later
        return;
      }

      const existing = store.get().library?.items || [];
      const nameSet = new Set(
        existing.map((x) =>
          String(x.name || "")
            .trim()
            .toLowerCase()
        )
      );

      const toNum = (v) => (Number.isFinite(+v) ? +v : 0);

      const cleaned = incoming
        .map((raw) => {
          const it = { ...raw };

          // Normalize base fields
          it.name = String(it.name || "").trim();
          if (!it.name) return null;
          const key = it.name.toLowerCase();
          if (nameSet.has(key)) return null; // skip duplicates by name

          it.type = it.type === "meal" ? "meal" : "ingredient";
          it.id = crypto?.randomUUID?.()
            ? crypto.randomUUID()
            : String(Date.now() + Math.random());
          it.category = it.category || "other";
          it.unit = it.type === "meal" ? "piece" : it.unit || "g";
          it.max = Math.max(
            1,
            parseInt(it.max || (it.type === "meal" ? 10 : 1000), 10)
          );

          // Macros
          it.per100 = it.per100 || {};
          it.per100 = {
            protein: toNum(it.per100.protein),
            fat: toNum(it.per100.fat),
            satFat: toNum(it.per100.satFat),
            carbs: toNum(it.per100.carbs),
            sugar: toNum(it.per100.sugar),
            fiber: toNum(it.per100.fiber),
            salt: toNum(it.per100.salt),
            kcal: Number.isFinite(+it.per100.kcal)
              ? Math.round(+it.per100.kcal)
              : undefined,
          };
          if (it.per100.kcal == null) {
            // compute kcal if missing
            it.per100.kcal = Math.round(
              (it.per100.protein || 0) * 4 +
                (it.per100.fat || 0) * 9 +
                (it.per100.carbs || 0) * 4
            );
          }

          // Meals: preserve gramsPerPiece, default to 0 if absent
          if (it.type === "meal") {
            it.gramsPerPiece = Math.max(
              0,
              parseInt(it.gramsPerPiece || 0, 10) || 0
            );
            if (!Array.isArray(it.items)) it.items = [];
          }

          nameSet.add(key);
          return it;
        })
        .filter(Boolean);

      if (cleaned.length) {
        store.set((prev) => ({
          ...prev,
          library: { ...prev.library, items: [...existing, ...cleaned] },
        }));
      }
    } catch {
      // silent fail by request
    } finally {
      e.target.value = ""; // reset input so same file can be chosen again
    }
  });

  // ---------- Initial render + subscribe ----------
  function renderAll() {
    renderLibrary();
    renderPot();
  }
  renderAll();

  // enable drag+drop reorder (binds now and after each render via MutationObserver)
  initLibraryReorder(store);

  store.subscribe(renderAll);
}
