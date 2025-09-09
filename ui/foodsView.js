// /ui/foodsView.js
export function initFoodsView(store, Core) {
  // ----- Add Ingredient dialog (button in Library header)
  const addBtn   = document.getElementById('libAddIngredientBtn');
  const dlg      = document.getElementById('ingredientDialog');
  const form     = document.getElementById('ingredientForm');
  const cancel   = document.getElementById('cancelIngredientBtn');
  const kcalOut  = document.getElementById('ingKcal');

  addBtn?.addEventListener('click', () => {
    form?.reset();
    if (kcalOut) kcalOut.value = '0';
    try { dlg.showModal(); } catch {}
  });
  cancel?.addEventListener('click', () => dlg?.close?.());

  form?.addEventListener('input', () => {
    const fd = new FormData(form);
    const per100 = {
      protein: +fd.get('protein') || 0,
      fat:     +fd.get('fat')     || 0,
      satFat:  +fd.get('satFat')  || 0,
      carbs:   +fd.get('carbs')   || 0,
      sugar:   +fd.get('sugar')   || 0,
      fiber:   +fd.get('fiber')   || 0,
      salt:    +fd.get('salt')    || 0,
    };
    const kcal = Math.round(Core.nutrition.kcalFromMacros(per100));
    if (kcalOut) kcalOut.value = String(kcal);
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    const category = String(fd.get('category') || 'other');
    const unit     = String(fd.get('unit') || 'g');
    const max      = Math.max(1, parseInt(fd.get('max') || '1000', 10) || 1000);
    const per100 = {
      protein: parseInt(fd.get('protein') || '0', 10) || 0,
      fat:     parseInt(fd.get('fat')     || '0', 10) || 0,
      satFat:  parseInt(fd.get('satFat')  || '0', 10) || 0,
      carbs:   parseInt(fd.get('carbs')   || '0', 10) || 0,
      sugar:   parseInt(fd.get('sugar')   || '0', 10) || 0,
      fiber:   parseInt(fd.get('fiber')   || '0', 10) || 0,
      salt:    parseInt(fd.get('salt')    || '0', 10) || 0,
    };
    per100.kcal = Math.round(Core.nutrition.kcalFromMacros(per100));
    const ing = Core.models.makeIngredient(name, category, unit, per100, max);
    store.set(s => ({ ...s, library: { ...s.library, items: [...s.library.items, ing] }}));
    dlg?.close?.();
    renderLibrary();
  });

  // ----- Library (right)
  const libGrid      = document.getElementById('libraryGrid');
  const libFilter    = document.getElementById('libFilter');
  const libCategory  = document.getElementById('libCategory');
  const searchInput  = document.getElementById('librarySearch');

  function renderLibrary() {
    if (!libGrid) return;
    const type = libFilter?.value || 'all';
    const cat  = libCategory?.value || 'all';
    const q    = (searchInput?.value || '').trim().toLowerCase();
    const items = store.get().library.items.filter(it=>{
      if (type !== 'all' && (it.kind || 'ingredient') !== type) return false;
      if (cat  !== 'all' && it.category !== cat) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
    libGrid.innerHTML = items.map(it => `
      <div class="lib-card" data-id="${it.id}">
        <div class="lib-actions">
          <button class="icon-btn lib-del" title="Delete">Del</button>
        </div>
        <strong>${escapeHtml(it.name)}</strong>
        <small>${(it.kind || 'ingredient')} • ${it.category}</small>
        <small>${Math.round(it.per100.kcal)} kcal / 100 ${it.unit}</small>
      </div>
    `).join('') || `<p class="hint">No items in library.</p>`;
  }
  [libFilter, libCategory, searchInput].forEach(el => el?.addEventListener('input', renderLibrary));

  libGrid?.addEventListener('click', (e) => {
    const del = e.target.closest('.lib-del');
    if (del) {
      const id = del.closest('.lib-card')?.dataset.id;
      if (!id) return;
      store.set(s => ({ ...s, library:{ ...s.library, items: s.library.items.filter(x=>x.id!==id) } }));
      renderLibrary(); renderPot();
      return;
    }
    const card = e.target.closest('.lib-card');
    if (!card) return;
    const id = card.dataset.id;
    if (pot.find(p => p.id === id)) return; // no duplicates in pot
    pot = [...pot, { id, amount: 100 }];
    renderPot();
  });

  // ----- Pot (left) with same card UI + sliders + delete
  const potList   = document.getElementById('potList');
  const potTotals = {
    kcal:   document.getElementById('pot-kcal'),
    protein:document.getElementById('pot-protein'),
    fat:    document.getElementById('pot-fat'),
    satFat: document.getElementById('pot-satfat'),
    carbs:  document.getElementById('pot-carbs'),
    sugar:  document.getElementById('pot-sugar'),
    fiber:  document.getElementById('pot-fiber'),
    salt:   document.getElementById('pot-salt'),
  };
  const saveMealBtn  = document.getElementById('savePotAsMealBtn');
  const clearPotBtn  = document.getElementById('clearPotBtn');

  // Save Meal dialog (reliable submit)
  const saveMealDlg  = document.getElementById('saveMealDialog');
  const saveMealForm = document.getElementById('saveMealForm');
  const mealNameInput= document.getElementById('mealNameInput');

  let pot = []; // [{id, amount}]

  function renderPot() {
    if (!potList) return;
    const lib = store.get().library.items;

    potList.innerHTML = pot.map(p => {
      const it = lib.find(x=>x.id===p.id); if (!it) return '';
      const c = makeCardMarkup(it, p.amount, true);
      return `<div class="pot-card" data-id="${p.id}">${c}</div>`;
    }).join('') || '';

    // wire pot sliders + delete
    potList.querySelectorAll('.pot-card').forEach(node => {
      const id = node.dataset.id;
      const slider = node.querySelector('.amount-slider');
      const out = node.querySelector('.food-card__amount-val');
      slider?.addEventListener('input', () => {
        const v = Number(slider.value)||0;
        out && (out.textContent = `${v} ${unitFromLib(id)}`);
        pot = pot.map(x => x.id===id ? ({ ...x, amount: v }) : x);
        renderPotSummary(); // live
      });
      node.querySelector('.delete-from-pot')?.addEventListener('click', () => {
        pot = pot.filter(x => x.id !== id);
        renderPot();
      });
    });

    renderPotSummary();
  }

  function renderPotSummary() {
    const lib = store.get().library.items;
    const agg = pot.reduce((a,p)=>{
      const it = lib.find(x=>x.id===p.id); if(!it) return a;
      const per100 = { ...it.per100, kcal: it.per100?.kcal ?? Math.round(Core.nutrition.kcalFromMacros(it.per100)) };
      const m = Core.nutrition.scaled(per100, p.amount||0);
      a.kcal   += m.kcal; a.protein+=m.protein; a.fat+=m.fat; a.satFat+=m.satFat;
      a.carbs  += m.carbs; a.sugar += m.sugar; a.fiber += m.fiber; a.salt += m.salt;
      return a;
    }, {kcal:0,protein:0,fat:0,satFat:0,carbs:0,sugar:0,fiber:0,salt:0});
    write(potTotals.kcal,   Math.round(agg.kcal));
    write(potTotals.protein,round1(agg.protein));
    write(potTotals.fat,    round1(agg.fat));
    write(potTotals.satFat, round1(agg.satFat));
    write(potTotals.carbs,  round1(agg.carbs));
    write(potTotals.sugar,  round1(agg.sugar));
    write(potTotals.fiber,  round1(agg.fiber));
    write(potTotals.salt,   round1(agg.salt));
  }

  function makeCardMarkup(item, amount, withDelete) {
    const p100 = { ...item.per100, kcal: item.per100?.kcal ?? Math.round(Core.nutrition.kcalFromMacros(item.per100)) };
    const m = Core.nutrition.scaled(p100, amount||0);
    const r1 = n => Core.nutrition.round1(n);
    return `
      <article class="food-card">
        <header class="food-card__head">
          <h4>${escapeHtml(item.name)}</h4>
          ${withDelete ? '<button class="btn btn-ghost btn-small delete-from-pot">Delete</button>' : ''}
        </header>
        <div class="food-card__meta">
          <small>Per 100 ${item.unit} — ${Math.round(p100.kcal)} kcal • P ${p100.protein||0}g • F ${p100.fat||0}g • Sat ${p100.satFat||0}g • C ${p100.carbs||0}g • S ${p100.sugar||0}g • Fiber ${p100.fiber||0}g • Salt ${p100.salt||0}g</small>
        </div>
        <label class="food-card__amount">Amount
          <span class="food-card__amount-val">${amount||0} ${item.unit}</span>
          <input class="amount-slider" type="range" min="0" max="${item.max||1000}" step="1" value="${amount||0}">
        </label>
        <div class="food-card__grid">
          ${macro('Kcal', Math.round(m.kcal))}
          ${macro('Protein', r1(m.protein))}
          ${macro('Fat',     r1(m.fat))}
          ${macro('Sat fat', r1(m.satFat))}
          ${macro('Carbs',   r1(m.carbs))}
          ${macro('Sugar',   r1(m.sugar))}
          ${macro('Fiber',   r1(m.fiber))}
          ${macro('Salt',    r1(m.salt))}
        </div>
      </article>
    `;
  }
  const macro = (label,val)=>`<div class="macro-row"><span>${label}</span><strong>${val}</strong></div>`;

  // Save Meal flow
  saveMealBtn?.addEventListener('click', () => {
    if (!pot.length) return;
    try { saveMealDlg.showModal(); } catch {}
    if (mealNameInput) mealNameInput.value = '';
    mealNameInput?.focus();
  });

  saveMealForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (mealNameInput?.value || '').trim();
    if (!name || !pot.length) { saveMealDlg.close(); return; }
    const lib = store.get().library.items;
    const components = pot.map(x => ({ itemId:x.id, amount:x.amount || 0 }));
    const meal = Core.models.makeMeal(name, components, { items: lib });
    meal.kind = 'meal';
    store.set(s => ({ ...s, library: { ...s.library, items: [...s.library.items, meal] } }));
    saveMealDlg.close();
  });

  const unitFromLib = id => store.get().library.items.find(x=>x.id===id)?.unit || 'g';
  const write = (el,v)=>{ if(el) el.textContent = String(v); };
  const round1=n=>Math.round((n||0)*10)/10;
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // first paint + subscriptions
  renderLibrary();
  renderPot();
  store.subscribe(() => { renderLibrary(); renderPot(); });
}
