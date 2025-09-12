// /ui/dayView.js
export function initDayView(store, Core) {
  const cats = ["breakfast", "lunch", "snack", "dinner", "extra"];

  // Containers for cards
  const containers = Object.fromEntries(
    cats.map((c) => [c, document.getElementById(`cards-${c}`)])
  );

  // Header chip boxes (created lazily, but we memo the nodes)
  const hdrBoxes = Object.fromEntries(cats.map((c) => [c, ensureHdrBox(c)]));

  // Targets (top tiles)
  const T = {
    kcal: document.getElementById("target-kcal"),
    protein: document.getElementById("target-protein"),
    fat: document.getElementById("target-fat"),
    satFat: document.getElementById("target-satFat"),
    carbs: document.getElementById("target-carbs"),
    sugar: document.getElementById("target-sugar"),
    fiber: document.getElementById("target-fiber"),
    salt: document.getElementById("target-salt"),
  };
  const targetsForm = document.getElementById("targetsForm");
  const resetDayBtn = document.getElementById("resetBtn");

  // ---------- utils ----------
  const r1 = (n) => Math.round((n || 0) * 10) / 10;
  const esc = (s = "") =>
    s.replace(
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

  const kcalFromMacros = (p) => {
    if (Core?.nutrition?.kcalFromMacros)
      return Core.nutrition.kcalFromMacros(p || {});
    const x = p || {};
    return (x.protein || 0) * 4 + (x.fat || 0) * 9 + (x.carbs || 0) * 4;
  };

  const withKcal = (per100 = {}) => {
    const p = {
      protein: 0,
      fat: 0,
      satFat: 0,
      carbs: 0,
      sugar: 0,
      fiber: 0,
      salt: 0,
      ...per100,
    };
    if (p.kcal == null) p.kcal = Math.round(kcalFromMacros(p));
    return p;
  };

  function readTargetsFromUI() {
    const num = (el) => (el ? +el.value || 0 : 0);
    return {
      kcal: num(T.kcal),
      protein: num(T.protein),
      fat: num(T.fat),
      satFat: num(T.satFat),
      carbs: num(T.carbs),
      sugar: num(T.sugar),
      fiber: num(T.fiber),
      salt: num(T.salt),
    };
  }

  // scale per 100g/ml to an amount in grams/ml
  const scaled = (per100, amount) => {
    const p = withKcal(per100);
    const f = (amount || 0) / 100;
    return {
      kcal: p.kcal * f,
      protein: (p.protein || 0) * f,
      fat: (p.fat || 0) * f,
      satFat: (p.satFat || 0) * f,
      carbs: (p.carbs || 0) * f,
      sugar: (p.sugar || 0) * f,
      fiber: (p.fiber || 0) * f,
      salt: (p.salt || 0) * f,
    };
  };

  // For day cards: if unit is "piece" (meal), convert pieces -> grams using gramsPerPiece
  function scaledForCard(card, amount) {
    const grams =
      card.unit === "piece"
        ? (card.gramsPerPiece || 0) * (amount || 0)
        : amount || 0;
    return scaled(card.per100, grams);
  }

  // Per piece (meal) helper for meta lines
  function perPieceMacros(card) {
    if (card.unit !== "piece") return null;
    const gpp = card.gramsPerPiece || 0;
    return scaled(card.per100, gpp);
  }

  const stepOf = (unit, type) =>
    unit === "piece" || type === "meal"
      ? 1
      : unit === "g" || unit === "ml"
      ? 5
      : 1;

  // ---------- targets (auto-kcal + save) ----------
  function autoKcal() {
    const P = +T.protein.value || 0;
    const F = +T.fat.value || 0;
    const C = +T.carbs.value || 0;
    const Fi = +T.fiber.value || 0;
    const kcal = Math.round(P * 4 + F * 9 + Math.max(0, C - Fi) * 4 + Fi * 2);
    T.kcal.value = kcal;
  }

  function pushTargetsToStore() {
    autoKcal(); // keep kcal derived from macros
    updateStore({ targets: readTargetsFromUI() }); // persist for reloads
    renderDailySummary(store.get()); // refresh summary immediately
  }

  targetsForm?.addEventListener("input", pushTargetsToStore);
  targetsForm?.addEventListener("change", pushTargetsToStore);

  resetDayBtn?.addEventListener("click", () => {
    store.set((s) => ({ ...s, day: { ...s.day, cards: [] } }));
  });

  function updateStore(payload) {
    if (typeof store.update === "function") store.update(payload);
    else store.set((s) => ({ ...s, ...payload }));
  }

  // ---------- Add-from-library dialog ----------
  const addDlg = document.getElementById("addToDayDialog");
  const addList = document.getElementById("addToDayList");
  const addType = document.getElementById("addToDayType");
  const addCat = document.getElementById("addToDayCategory");
  const addSearch = document.getElementById("addToDaySearch");
  let currentAddCat = "extra";

  document.getElementById("dayBoards")?.addEventListener("click", (e) => {
    const resetBtn = e.target.closest(".reset-cat");
    if (resetBtn) {
      const cat = resetBtn.dataset.reset;
      store.set((s) => ({
        ...s,
        day: {
          ...s.day,
          cards: (s.day.cards || []).filter((c) => c.category !== cat),
        },
      }));
      return;
    }
    const addBtn = e.target.closest(".add-from-lib");
    if (addBtn) {
      currentAddCat = addBtn.dataset.cat || "extra";
      renderAddList();
      try {
        addDlg.showModal();
      } catch {}
    }
  });

  // Unified filter: search > category > type
  function filterLibraryItems(
    items,
    { type = "all", category = "all", query = "" }
  ) {
    const q = String(query || "")
      .trim()
      .toLowerCase();

    if (q) {
      return items.filter((x) =>
        String(x.name || "")
          .toLowerCase()
          .includes(q)
      );
    }
    if (category !== "all") {
      return items.filter((x) => x.category === category);
    }
    if (type !== "all") {
      return items.filter((x) => (x.type || x.kind || "ingredient") === type);
    }
    return items;
  }

  function renderAddList() {
    if (!addList) return;

    const s = store.get();
    const all = s.library?.items || [];

    const items = filterLibraryItems(all, {
      type: addType?.value || "all",
      category: addCat?.value || "all",
      query: addSearch?.value || "",
    });

    addList.innerHTML =
      items
        .map((it) => {
          const kind = it.type || it.kind || "ingredient";
          const isMeal = kind === "meal";
          const p100 = withKcal(it.per100);
          const one = isMeal ? scaled(p100, it.gramsPerPiece || 0) : null;
          return `
          <button type="button" class="picker-item" data-id="${it.id}">
            <div class="pi-left">
              <strong>${esc(it.name)}</strong>
              <small class="pi-sub">
                <span class="pi-tag ${isMeal ? "is-meal" : "is-ing"}">${
            isMeal ? "Meal" : "Ingredient"
          }</span>
                ${
                  isMeal
                    ? `${Math.round(it.gramsPerPiece || 0)} g / piece`
                    : `${esc(it.category || "other")} • per 100 ${esc(
                        it.unit || "g"
                      )}`
                }
              </small>
            </div>
            <div class="pi-right">
              <small>${
                isMeal
                  ? `${Math.round(one?.kcal || 0)} kcal / piece`
                  : `${Math.round(p100.kcal)} kcal / 100`
              }</small>
            </div>
          </button>`;
        })
        .join("") || `<p class="hint">No matches.</p>`;
  }

  addSearch?.addEventListener("input", renderAddList);
  addType?.addEventListener("change", renderAddList);
  addCat?.addEventListener("change", renderAddList);

  addList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".picker-item");
    if (!btn) return;
    const it = (store.get().library?.items || []).find(
      (x) => x.id === btn.dataset.id
    );
    if (!it) return;

    let card = Core.models.makeDayCardFromLibrary(it, currentAddCat, 0);
    card.type = it.type || it.kind || "ingredient";
    if (card.type === "meal") {
      card.unit = "piece";
      card.amount = 1;
      card.max = it.max || 10;
      card.gramsPerPiece = it.gramsPerPiece || 0;
    }

    store.set((s) => ({
      ...s,
      day: { ...s.day, cards: [...(s.day.cards || []), card] },
    }));
    addDlg?.close?.();
  });

  // ---------- cards ----------
  const macro = (label, val) =>
    `<div class="macro-row"><span>${label}</span><strong>${val}</strong></div>`;

  function cardHTML(c) {
    const isMeal = c.unit === "piece" || c.type === "meal";
    const p100 = withKcal(c.per100);
    const m = scaledForCard(c, c.amount || 0);

    const meta = isMeal
      ? (() => {
          const one = perPieceMacros(c) || {
            kcal: 0,
            protein: 0,
            fat: 0,
            satFat: 0,
            carbs: 0,
            sugar: 0,
            fiber: 0,
            salt: 0,
          };
          const gpp = c.gramsPerPiece
            ? ` (${Math.round(c.gramsPerPiece)} g)`
            : "";
          return `Per 1 piece${gpp} — ${Math.round(one.kcal)} kcal • P ${r1(
            one.protein
          )}g • F ${r1(one.fat)}g • Sat ${r1(one.satFat)}g • C ${r1(
            one.carbs
          )}g • S ${r1(one.sugar)}g • Fiber ${r1(one.fiber)}g • Salt ${r1(
            one.salt
          )}g`;
        })()
      : `Per 100 ${esc(c.unit || "g")} — ${Math.round(p100.kcal)} kcal • P ${
          p100.protein || 0
        }g • F ${p100.fat || 0}g • Sat ${p100.satFat || 0}g • C ${
          p100.carbs || 0
        }g • S ${p100.sugar || 0}g • Fiber ${p100.fiber || 0}g • Salt ${
          p100.salt || 0
        }g`;

    const displayUnit = isMeal ? "piece" : c.unit || "g";
    const step = stepOf(c.unit, c.type);

    return `
      <article class="food-card" data-id="${c.id}" data-cat="${c.category}">
        <header class="food-card__head">
          <h4>${esc(c.name)}</h4>
          <div class="row gap">
            <button class="btn btn-ghost btn-small delete-card" type="button">Delete</button>
          </div>
        </header>
        <div class="food-card__meta"><small>${meta}</small></div>
        <label class="food-card__amount">Amount
          <span class="food-card__amount-val">${c.amount || 0} ${esc(
      displayUnit
    )}</span>
          <input class="amount-slider" type="range"
            min="0" max="${
              c.max || (isMeal ? 10 : 1000)
            }" step="${step}" value="${c.amount || 0}">
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
      </article>`;
  }

  function unitOf(id) {
    const c = store.get().day.cards.find((x) => x.id === id);
    return c?.unit || "g";
  }
  function typeOf(id) {
    const c = store.get().day.cards.find((x) => x.id === id);
    return c?.type || "ingredient";
  }

  function wireCardEvents() {
    cats.forEach((cat) => {
      const host = containers[cat];
      if (!host || host.dataset.eventsBound === "1") return;
      host.dataset.eventsBound = "1";

      // Delete (delegate)
      host.addEventListener("click", (e) => {
        const delBtn = e.target.closest(".delete-card");
        if (!delBtn) return;
        const card = delBtn.closest(".food-card");
        const id = card?.dataset.id;
        if (!id) return;
        store.set((s) => ({
          ...s,
          day: {
            ...s.day,
            cards: (s.day.cards || []).filter((x) => x.id !== id),
          },
        }));
      });

      // Slider live preview (delegate)
      host.addEventListener("input", (e) => {
        const slider = e.target.closest(".amount-slider");
        if (!slider) return;
        const card = slider.closest(".food-card");
        const id = card?.dataset.id;
        if (!id) return;

        const v = Number(slider.value) || 0;
        const displayUnit =
          unitOf(id) === "piece" || typeOf(id) === "meal"
            ? "piece"
            : unitOf(id);
        const out = card.querySelector(".food-card__amount-val");
        if (out) out.textContent = `${v} ${displayUnit}`;

        const c = store.get().day.cards.find((x) => x.id === id);
        if (!c) return;
        const m = scaledForCard(c, v);
        const grid = card.querySelector(".food-card__grid");
        if (grid) {
          grid.innerHTML = `
          ${macro("Kcal", Math.round(m.kcal))}
          ${macro("Protein", r1(m.protein))}
          ${macro("Fat", r1(m.fat))}
          ${macro("Sat fat", r1(m.satFat))}
          ${macro("Carbs", r1(m.carbs))}
          ${macro("Sugar", r1(m.sugar))}
          ${macro("Fiber", r1(m.fiber))}
          ${macro("Salt", r1(m.salt))}
        `;
        }
        liveSummaries(cat, id, v);
      });

      // Slider commit (delegate)
      host.addEventListener("change", (e) => {
        const slider = e.target.closest(".amount-slider");
        if (!slider) return;
        const card = slider.closest(".food-card");
        const id = card?.dataset.id;
        if (!id) return;
        const v = Number(slider.value) || 0;
        store.set((s) => {
          const cards = (s.day.cards || []).map((x) =>
            x.id === id ? { ...x, amount: v } : x
          );
          return { ...s, day: { ...s.day, cards } };
        });
      });
    });
  }

  // ---------- DnD reorder across categories (drag by card header area) ----------
  const DND = { dragId: null, sourceCat: null, placeholder: null };

  function ensurePlaceholder(refCard) {
    if (!DND.placeholder) {
      const ph = document.createElement("div");
      ph.className = "drag-placeholder";
      ph.style.border = "1px dashed var(--accent, #5aa2ff)";
      ph.style.borderRadius = "12px";
      ph.style.margin = "6px 0";
      ph.style.opacity = "0.9";
      ph.style.background = "transparent";
      DND.placeholder = ph;
    }
    const h = refCard?.getBoundingClientRect()?.height || 64;
    DND.placeholder.style.height = `${Math.max(48, Math.min(200, h))}px`;
    return DND.placeholder;
  }
  function clearPlaceholder() {
    DND.placeholder?.parentNode?.removeChild(DND.placeholder);
  }

  // --- DnD: bind per-card drag handles (header is the handle) ---
  function bindDragHandles() {
    cats.forEach((cat) => {
      const host = containers[cat];
      if (!host) return;

      host.querySelectorAll(".food-card").forEach((card) => {
        if (card.dataset.dndBound === "1") return;
        card.dataset.dndBound = "1";

        const header = card.querySelector(".food-card__head");
        if (!header) return;

        // Make ONLY the header draggable (more reliable across browsers)
        header.setAttribute("draggable", "true");

        // Prevent text selection while starting a drag
        header.addEventListener("selectstart", (e) => e.preventDefault());

        header.addEventListener("dragstart", (e) => {
          const el = e.currentTarget.closest(".food-card");
          if (!el) return;

          DND.dragId = el.dataset.id;
          DND.sourceCat = el.dataset.cat || cat;
          el.classList.add("dragging");

          try {
            e.dataTransfer?.setData("text/plain", DND.dragId || "move"); // needed for FF
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.dropEffect = "move";
            // use the card as the drag image so it feels natural
            e.dataTransfer?.setDragImage?.(el, el.clientWidth / 2, 20);
          } catch {}
          ensurePlaceholder(el);
        });

        header.addEventListener("dragend", () => {
          card.classList.remove("dragging");
          DND.dragId = null;
          DND.sourceCat = null;
          clearPlaceholder();
        });
      });
    });
  }

  function attachHostDnD() {
    cats.forEach((cat) => {
      const host = containers[cat];
      if (!host || host.dataset.dndHostBound === "1") return;
      host.dataset.dndHostBound = "1";

      let raf = 0;

      host.addEventListener("dragenter", (e) => {
        if (DND.dragId) e.preventDefault();
      });

      host.addEventListener("dragover", (e) => {
        if (!DND.dragId) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        if (raf) return;

        raf = requestAnimationFrame(() => {
          raf = 0;

          const cards = Array.from(host.querySelectorAll(".food-card"));
          const y = e.clientY;
          let target = null;
          let before = true;

          for (const c of cards) {
            if (c.classList.contains("dragging")) continue;
            const r = c.getBoundingClientRect();
            const mid = r.top + r.height / 2;
            if (y < mid) {
              target = c;
              before = true;
              break;
            }
            target = c;
            before = false;
          }

          const ph = ensurePlaceholder(target || cards[0]);
          if (target) {
            target.parentNode.insertBefore(
              ph,
              before ? target : target.nextElementSibling
            );
          } else {
            host.appendChild(ph);
          }
        });
      });

      host.addEventListener("drop", (e) => {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        e.preventDefault();
        if (!DND.dragId) return;

        const m = host.id.match(/^cards-(.+)$/);
        const destCat = m ? m[1] : DND.sourceCat || "extra";

        // Decide insertion point from placeholder
        const siblings = Array.from(host.querySelectorAll(".food-card"));
        let destIndex = siblings.length;
        const next = DND.placeholder?.nextElementSibling;
        if (next && next.classList.contains("food-card")) {
          const idx = siblings.indexOf(next);
          if (idx >= 0) destIndex = idx;
        }

        store.set((s) => {
          const all = Array.from(s.day.cards || []);
          const movingIdx = all.findIndex((c) => c.id === DND.dragId);
          if (movingIdx === -1) return s;

          const moving = { ...all[movingIdx] };
          const sourceCat = moving.category || DND.sourceCat || "extra";

          // Category buckets, stable by 'order'
          const lists = Object.fromEntries(
            cats.map((c) => [
              c,
              all
                .filter((x) => (x.category || "extra") === c)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
            ])
          );

          // Remove from source
          const src = lists[sourceCat] || [];
          const srcPos = src.findIndex((x) => x.id === moving.id);
          if (srcPos !== -1) src.splice(srcPos, 1);

          // Insert into destination
          const dst = lists[destCat] || [];
          const insertAt = Math.min(Math.max(destIndex, 0), dst.length);
          moving.category = destCat;
          dst.splice(insertAt, 0, moving);

          // Rebuild flat array & reindex order per category
          const rebuilt = [];
          cats.forEach((c) =>
            (lists[c] || []).forEach((item, i) =>
              rebuilt.push({ ...item, order: i })
            )
          );

          return { ...s, day: { ...s.day, cards: rebuilt } };
        });

        clearPlaceholder();
      });
    });
  }

  // ---------- summaries ----------
  function totalsFromCards(cards = []) {
    return cards.reduce(
      (a, c) => {
        const m = scaledForCard(c, c.amount || 0);
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
  }

  function liveSummaries(cat, id, tempAmount) {
    const s = store.get();

    const catItems = (s.day.cards || [])
      .map((c) => (c.id === id ? { ...c, amount: tempAmount } : c))
      .filter((c) => c.category === cat);
    writeHdr(cat, totalsFromCards(catItems), catItems.length);

    const all = (s.day.cards || []).map((c) =>
      c.id === id ? { ...c, amount: tempAmount } : c
    );
    renderDailySummary({ day: { cards: all } });
  }

  function renderDailySummary(state) {
    const sum = totalsFromCards(state.day.cards || []);
    const t = readTargetsFromUI();
    write("#sum-kcal", Math.round(sum.kcal));
    pct("#sum-kcal-pct", sum.kcal, t.kcal);
    write("#sum-protein", r1(sum.protein));
    pct("#sum-protein-pct", sum.protein, t.protein);
    write("#sum-fat", r1(sum.fat));
    pct("#sum-fat-pct", sum.fat, t.fat);
    write("#sum-satfat", r1(sum.satFat));
    pct("#sum-satfat-pct", sum.satFat, t.satFat);
    write("#sum-carbs", r1(sum.carbs));
    pct("#sum-carbs-pct", sum.carbs, t.carbs);
    write("#sum-sugar", r1(sum.sugar));
    pct("#sum-sugar-pct", sum.sugar, t.sugar);
    write("#sum-fiber", r1(sum.fiber));
    pct("#sum-fiber-pct", sum.fiber, t.fiber);
    write("#sum-salt", r1(sum.salt));
    pct("#sum-salt-pct", sum.salt, t.salt);
  }
  function write(sel, val) {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  }
  function pct(sel, v, t) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.textContent = (t > 0 ? Math.round((v / t) * 100) : 0) + "%";
  }

  // ---------- header chips ----------
  function ensureHdrBox(cat) {
    let box = document.getElementById(`hdrsum-${cat}`);
    if (box) return box;

    const board =
      document.getElementById(`board-${cat}`) ||
      document.getElementById(`cards-${cat}`)?.closest(".board");
    const head =
      board?.querySelector(".board__head") || board?.firstElementChild;
    if (!head) return null;

    box = document.createElement("div");
    box.id = `hdrsum-${cat}`;
    box.className = "chips";

    const actions = head.querySelector(".right-actions, .board__actions");
    if (actions) head.insertBefore(box, actions);
    else head.appendChild(box);

    return box;
  }

  function writeHdr(cat, sum, count) {
    const box = hdrBoxes[cat] || ensureHdrBox(cat);
    if (!box) return;
    if (!count) {
      box.innerHTML = "";
      return;
    }
    const chip = (txt) => `<span class="chip">${txt}</span>`;
    box.innerHTML = [
      chip(`${Math.round(sum.kcal)} kcal`),
      chip(`P ${r1(sum.protein)}`),
      chip(`F ${r1(sum.fat)}`),
      chip(`Sat ${r1(sum.satFat)}`),
      chip(`C ${r1(sum.carbs)}`),
      chip(`S ${r1(sum.sugar)}`),
      chip(`Fi ${r1(sum.fiber)}`),
      chip(`Sa ${r1(sum.salt)}`),
    ].join("");
  }

  // ---------- main render ----------
  function render() {
    const state = store.get();

    // populate targets once
    Object.keys(T).forEach((k) => {
      if (T[k] && T[k].value === "") T[k].value = state.targets?.[k] ?? "";
    });
    autoKcal();

    cats.forEach((cat) => {
      const host = containers[cat];
      if (!host) return;
      const cards = (state.day.cards || [])
        .filter((c) => c.category === cat)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      host.innerHTML = cards.map(cardHTML).join("");
      writeHdr(cat, totalsFromCards(cards), cards.length);
    });

    wireCardEvents();
    renderDailySummary(state);

    // Bind DnD each time after render (idempotent via data-* flags)
    bindDragHandles();
    attachHostDnD();
  }

  render();
  store.subscribe(render);
}
