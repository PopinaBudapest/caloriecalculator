// ------------------ categories ------------------
const CATEGORIES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch",     label: "Lunch" },
  { id: "dinner",    label: "Dinner" },
  { id: "other",     label: "Others" }
];

// ------------------ daily targets (edit these to your needs) ------------------
const DAILY_TARGETS = {
  kcal: 2000, protein: 50, fat: 70, satFat: 20,
  carbs: 260, sugar: 90, fiber: 30, salt: 6
};

// ------------------ persistence ------------------
const KEY = "calorie_cards_v2";

function defaultSeed() {
  return {
    cards: [
      { id: uid(), category: "breakfast", order: 0, name: "Milk (3.5%)", unit: "ml", max: 1000, amount: 250,
        per100: { kcal: 64, protein: 3.4, fat: 3.6, satFat: 2.3, carbs: 4.8, sugar: 4.8, fiber: 0,   salt: 0.1 } },
      { id: uid(), category: "lunch",     order: 0, name: "Rice (cooked)",  unit: "g",  max: 500,  amount: 200,
        per100: { kcal: 130, protein: 2.7, fat: 0.3, satFat: 0.1, carbs: 28,  sugar: 0.1, fiber: 0.4, salt: 0   } }
    ]
  };
}
function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!s) {
    try {
      const old = JSON.parse(localStorage.getItem("calorie_cards_v1"));
      if (old) {
        old.cards.forEach(c => { if (!c.category) c.category = "other"; });
        s = old;
      }
    } catch {}
  }
  // migrations
  if (s && Array.isArray(s.cards)) {
    const idxByCat = { breakfast:0, lunch:0, dinner:0, other:0 };
    s.cards.forEach(c => {
      if (c.order === undefined) c.order = idxByCat[c.category]++ | 0;
      if (!c.per100) c.per100 = {};
      if (c.per100.satFat === undefined) c.per100.satFat = 0;
      if (c.per100.fiber  === undefined) c.per100.fiber  = 0;
      if (c.per100.salt   === undefined) c.per100.salt   = 0;
    });
  }
  return s ?? defaultSeed();
}
function save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }

const state = load();

// ------------------ utils ------------------
const q = (sel, el=document) => el.querySelector(sel);
function uid() { return Math.random().toString(36).slice(2, 9); }
const round1 = n => Math.round(n * 10) / 10;
const todayISODate = () => new Date().toISOString().slice(0,10);
const pctOf = (value, target) => target > 0 ? Math.round((value / target) * 100) : 0;

// pure calc
function scaled(per100, amount) {
  const f = (amount || 0) / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    fat: per100.fat * f,
    satFat: (per100.satFat ?? 0) * f,
    carbs: per100.carbs * f,
    sugar: per100.sugar * f,
    fiber: (per100.fiber ?? 0) * f,
    salt: (per100.salt ?? 0) * f
  };
}
function totals(cards) {
  return cards.reduce((acc, c) => {
    const m = scaled(c.per100, c.amount);
    acc.kcal += m.kcal; acc.protein += m.protein; acc.fat += m.fat; acc.satFat += m.satFat;
    acc.carbs += m.carbs; acc.sugar += m.sugar; acc.fiber += m.fiber; acc.salt += m.salt;
    return acc;
  }, { kcal:0, protein:0, fat:0, satFat:0, carbs:0, sugar:0, fiber:0, salt:0 });
}

// ------------------ summary ------------------
const sumEl = {
  kcal: q("#sum-kcal"), protein: q("#sum-protein"), fat: q("#sum-fat"),
  satFat: q("#sum-satfat"), carbs: q("#sum-carbs"), sugar: q("#sum-sugar"),
  fiber: q("#sum-fiber"), salt: q("#sum-salt")
};
const pctEl = {
  kcal: q("#sum-kcal-pct"), protein: q("#sum-protein-pct"), fat: q("#sum-fat-pct"),
  satFat: q("#sum-satfat-pct"), carbs: q("#sum-carbs-pct"), sugar: q("#sum-sugar-pct"),
  fiber: q("#sum-fiber-pct"), salt: q("#sum-salt-pct")
};
function renderSummary() {
  const t = totals(state.cards);
  sumEl.kcal.textContent = Math.round(t.kcal);
  pctEl.kcal.textContent = pctOf(t.kcal, DAILY_TARGETS.kcal) + "%";

  sumEl.protein.textContent = round1(t.protein);
  pctEl.protein.textContent = pctOf(t.protein, DAILY_TARGETS.protein) + "%";

  sumEl.fat.textContent = round1(t.fat);
  pctEl.fat.textContent = pctOf(t.fat, DAILY_TARGETS.fat) + "%";

  sumEl.satFat.textContent = round1(t.satFat);
  pctEl.satFat.textContent = pctOf(t.satFat, DAILY_TARGETS.satFat) + "%";

  sumEl.carbs.textContent = round1(t.carbs);
  pctEl.carbs.textContent = pctOf(t.carbs, DAILY_TARGETS.carbs) + "%";

  sumEl.sugar.textContent = round1(t.sugar);
  pctEl.sugar.textContent = pctOf(t.sugar, DAILY_TARGETS.sugar) + "%";

  sumEl.fiber.textContent = round1(t.fiber);
  pctEl.fiber.textContent = pctOf(t.fiber, DAILY_TARGETS.fiber) + "%";

  sumEl.salt.textContent = round1(t.salt);
  pctEl.salt.textContent = pctOf(t.salt, DAILY_TARGETS.salt) + "%";
}

// ------------------ board containers ------------------
const containers = {
  breakfast: q("#cards-breakfast"),
  lunch: q("#cards-lunch"),
  dinner: q("#cards-dinner"),
  other: q("#cards-other"),
};

// ------------------ rendering ------------------
function renderAll() {
  Object.values(containers).forEach(el => el.innerHTML = "");

  const grouped = { breakfast:[], lunch:[], dinner:[], other:[] };
  state.cards.forEach(c => (grouped[c.category] || grouped.other).push(c));
  Object.entries(grouped).forEach(([cat, arr]) => {
    arr.sort((a,b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
    arr.forEach(card => containers[cat].append(renderCard(card)));
  });

  renderSummary();
  save(state);
  setupContainerDnD();
}

function renderCard(model) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = model.id;

  // header (DRAG HANDLE)
  const header = document.createElement("div");
  header.className = "card__head";
  header.setAttribute("draggable", "true");

  const title = document.createElement("div");
  title.className = "card__title";
  title.textContent = model.name;

  const actions = document.createElement("div");
  actions.className = "card__actions";

  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.title = "Modify";
  editBtn.textContent = "Modify";
  editBtn.addEventListener("click", (ev) => { ev.stopPropagation(); openDialogForEdit(model.id); });

  const delBtn = document.createElement("button");
  delBtn.className = "icon-btn";
  delBtn.title = "Delete";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const idx = state.cards.findIndex(c => c.id === model.id);
    if (idx >= 0) { state.cards.splice(idx, 1); renderAll(); }
  });

  actions.append(editBtn, delBtn);
  header.append(title, actions);

  // meta (two lines)
  const meta = document.createElement("div");
  meta.className = "card__meta";
  const catLabel = (CATEGORIES.find(c => c.id === model.category) || {label:""}).label;
  const p = model.per100;
  meta.innerHTML =
    `${catLabel} • Per 100 ${model.unit} — ${p.kcal} kcal, P ${p.protein}g • F ${p.fat}g • Sat ${p.satFat ?? 0}g` +
    `<br>` +
    `C ${p.carbs}g • S ${p.sugar}g • Fiber ${p.fiber ?? 0}g • Salt ${p.salt ?? 0}g`;

  // slider + readouts
  const sliderWrap = document.createElement("div");
  sliderWrap.className = "card__slider";

  const amountRow = document.createElement("div");
  amountRow.className = "amount-row";
  const amountLabel = document.createElement("span");
  amountLabel.textContent = "Amount";
  const amountVal = document.createElement("strong");
  amountVal.textContent = `${model.amount ?? 0} ${model.unit}`;
  amountRow.append(amountLabel, amountVal);

  const range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = String(model.max ?? 1000);
  range.step = "5";
  range.value = String(model.amount ?? 0);
  range.setAttribute("aria-label", `${model.name} amount in ${model.unit}`);

  const reads = document.createElement("div");
  reads.className = "readouts";

  function update(amount) {
    const m = scaled(model.per100, amount);
    amountVal.textContent = `${amount} ${model.unit}`;
    reads.innerHTML = `
      <div><span>Kcal</span><strong>${Math.round(m.kcal)}</strong></div>
      <div><span>Protein</span><strong>${round1(m.protein)}</strong></div>
      <div><span>Fat</span><strong>${round1(m.fat)}</strong></div>
      <div><span>Sat fat</span><strong>${round1(m.satFat)}</strong></div>
      <div><span>Carbs</span><strong>${round1(m.carbs)}</strong></div>
      <div><span>Sugar</span><strong>${round1(m.sugar)}</strong></div>
      <div><span>Fiber</span><strong>${round1(m.fiber)}</strong></div>
      <div><span>Salt</span><strong>${round1(m.salt)}</strong></div>
    `;
  }
  update(Number(range.value));

  range.addEventListener("input", e => {
    model.amount = Number(e.target.value);
    update(model.amount);
    renderSummary();
    save(state);
  });

  // DnD: only from header
  header.addEventListener("dragstart", (e) => {
    card.classList.add("dragging");
    e.dataTransfer.setData("text/plain", model.id);
    e.dataTransfer.effectAllowed = "move";
  });
  header.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    syncOrderFromDOM();
    renderSummary();
  });

  sliderWrap.append(amountRow, range, reads);
  card.append(header, meta, sliderWrap);
  return card;
}

// ------------------ DnD between/within boards ------------------
function setupContainerDnD() {
  Object.entries(containers).forEach(([cat, container]) => {
    const board = container.closest(".board");

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      board.classList.add("drag-over");
      const after = getDragAfterElement(container, e.clientY);
      const dragging = document.querySelector(".dragging");
      if (!dragging) return;
      if (!after) container.appendChild(dragging);
      else container.insertBefore(dragging, after);
    });

    container.addEventListener("dragleave", () => {
      board.classList.remove("drag-over");
    });

    container.addEventListener("drop", (e) => {
      e.preventDefault();
      board.classList.remove("drag-over");
      syncOrderFromDOM();
      renderAll();
    });
  });
}
function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".card:not(.dragging)")];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - (box.top + box.height / 2);
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}
function syncOrderFromDOM() {
  const byId = new Map(state.cards.map(c => [c.id, c]));
  Object.entries(containers).forEach(([cat, el]) => {
    [...el.children].forEach((child, idx) => {
      const item = byId.get(child.dataset.id);
      if (item) { item.category = cat; item.order = idx; }
    });
  });
  save(state);
}

// ------------------ Add / Edit dialog ------------------
const addBtn = q("#addFoodBtn");
const dlg = q("#foodDialog");
const form = q("#foodForm");
const cancelBtn = q("#cancelBtn");
const dialogTitle = q("#dialogTitle");
const submitBtn = q("#submitBtn");
let editingId = null;

function nextOrderForCategory(cat) {
  let max = -1;
  state.cards.forEach(c => { if (c.category === cat && typeof c.order === "number") max = Math.max(max, c.order); });
  return max + 1;
}

function openDialogForAdd() {
  editingId = null;
  form.reset();
  dialogTitle.textContent = "Add Food";
  submitBtn.textContent = "Add";
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
}
function openDialogForEdit(id) {
  const item = state.cards.find(c => c.id === id);
  if (!item) return;
  editingId = id;
  dialogTitle.textContent = "Modify Food";
  submitBtn.textContent = "Save";
  form.name.value = item.name;
  form.category.value = item.category;
  form.unit.value = item.unit;
  form.max.value = item.max;
  form.kcal.value = item.per100.kcal;
  form.protein.value = item.per100.protein;
  form.fat.value = item.per100.fat;
  form.satFat.value = item.per100.satFat ?? 0;
  form.carbs.value = item.per100.carbs;
  form.sugar.value = item.per100.sugar;
  form.fiber.value = item.per100.fiber ?? 0;
  form.salt.value = item.per100.salt ?? 0;
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
}
addBtn.addEventListener("click", openDialogForAdd);
cancelBtn.addEventListener("click", () => {
  if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const cat = String(fd.get("category"));

  if (editingId) {
    const item = state.cards.find(c => c.id === editingId);
    if (item) {
      const prevCat = item.category;
      item.name = String(fd.get("name")).trim();
      item.category = cat;
      item.unit = String(fd.get("unit"));
      item.max = Number(fd.get("max")) || 1000;
      item.per100 = {
        kcal: Number(fd.get("kcal")),
        protein: Number(fd.get("protein")),
        fat: Number(fd.get("fat")),
        satFat: Number(fd.get("satFat")),
        carbs: Number(fd.get("carbs")),
        sugar: Number(fd.get("sugar")),
        fiber: Number(fd.get("fiber")),
        salt: Number(fd.get("salt"))
      };
      if (cat !== prevCat) item.order = nextOrderForCategory(cat);
    }
  } else {
    state.cards.push({
      id: uid(),
      category: cat,
      order: nextOrderForCategory(cat),
      name: String(fd.get("name")).trim(),
      unit: String(fd.get("unit")),
      max: Number(fd.get("max")) || 1000,
      amount: 0,
      per100: {
        kcal: Number(fd.get("kcal")),
        protein: Number(fd.get("protein")),
        fat: Number(fd.get("fat")),
        satFat: Number(fd.get("satFat")),
        carbs: Number(fd.get("carbs")),
        sugar: Number(fd.get("sugar")),
        fiber: Number(fd.get("fiber")),
        salt: Number(fd.get("salt"))
      }
    });
  }

  if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  renderAll();
});

// ------------------ Reset buttons ------------------
q("#resetBtn").addEventListener("click", () => {
  state.cards.forEach(c => c.amount = 0);
  renderAll();
});
document.querySelectorAll(".reset-cat").forEach(btn => {
  btn.addEventListener("click", () => {
    const cat = btn.dataset.reset;
    state.cards.forEach(c => { if (c.category === cat) c.amount = 0; });
    renderAll();
  });
});

// ------------------ Save / Load to file ------------------
const saveBtn = q("#saveFileBtn");
const loadBtn = q("#loadFileBtn");
const loadInput = q("#loadFileInput");

saveBtn.addEventListener("click", async () => {
  const payload = buildExportObject();
  const filename = `calories_${todayISODate()}.json`;

  if (window.isSecureContext && "showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      await writable.close();
    } catch (err) {
      if (err && err.name !== "AbortError") alert("Save failed: " + err.message);
    }
  } else {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
});

loadBtn.addEventListener("click", async () => {
  if (window.isSecureContext && "showOpenFilePicker" in window) {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
      });
      const file = await handle.getFile();
      const text = await file.text();
      handleImportedText(text);
    } catch (err) {
      if (err && err.name !== "AbortError") alert("Load failed: " + err.message);
    }
  } else {
    loadInput.value = "";
    loadInput.click();
  }
});
loadInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const text = await file.text();
  handleImportedText(text);
});

function buildExportObject() {
  const t = totals(state.cards);
  return {
    version: 7,
    exportedAt: new Date().toISOString(),
    totals: {
      kcal: Math.round(t.kcal),
      protein: round1(t.protein),
      fat: round1(t.fat),
      satFat: round1(t.satFat),
      carbs: round1(t.carbs),
      sugar: round1(t.sugar),
      fiber: round1(t.fiber),
      salt: round1(t.salt)
    },
    cards: state.cards
  };
}
function handleImportedText(text) {
  try {
    const data = JSON.parse(text);
    validateImport(data);
    const idxByCat = { breakfast:0, lunch:0, dinner:0, other:0 };
    data.cards.forEach(c => {
      if (!c.per100) c.per100 = {};
      if (c.per100.satFat === undefined) c.per100.satFat = 0;
      if (c.per100.fiber  === undefined) c.per100.fiber  = 0;
      if (c.per100.salt   === undefined) c.per100.salt   = 0;
      if (c.order === undefined) c.order = idxByCat[c.category]++ | 0;
    });
    state.cards = JSON.parse(JSON.stringify(data.cards));
    renderAll();
    alert("Loaded successfully.");
  } catch (err) {
    alert("Invalid file: " + (err && err.message ? err.message : err));
  }
}
function validateImport(obj) {
  if (typeof obj !== "object" || obj === null) throw new Error("Root is not an object.");
  if (!Array.isArray(obj.cards)) throw new Error("Missing 'cards' array.");
  obj.cards.forEach((c, i) => {
    const path = `cards[${i}]`;
    ["id", "name", "category", "unit"].forEach(k => {
      if (typeof c[k] !== "string") throw new Error(`${path}.${k} must be a string`);
    });
    if (typeof c.max !== "number") throw new Error(`${path}.max must be a number`);
    if (typeof c.amount !== "number") throw new Error(`${path}.amount must be a number`);
    if (!c.per100 || typeof c.per100 !== "object") throw new Error(`${path}.per100 missing`);
    ["kcal","protein","fat","carbs","sugar"].forEach(k => {
      if (typeof c.per100[k] !== "number") throw new Error(`${path}.per100.${k} must be a number`);
    });
    // Optional numeric fields if present
    ["satFat","fiber","salt"].forEach(k => {
      if (c.per100[k] !== undefined && typeof c.per100[k] !== "number") {
        throw new Error(`${path}.per100.${k} must be a number if present`);
      }
    });
    if (!["breakfast","lunch","dinner","other"].includes(c.category)) {
      throw new Error(`${path}.category invalid`);
    }
    if (!["ml","g"].includes(c.unit)) throw new Error(`${path}.unit must be 'ml' or 'g'`);
  });
}

// ------------------ boot ------------------
renderAll();
setupContainerDnD();
