// /ui/dayView.js
export function initDayView(store, Core) {
  const cats = ['breakfast','lunch','snack','dinner','extra'];
  const containers = Object.fromEntries(cats.map(c => [c, document.getElementById(`cards-${c}`)]));
  const hdrBoxes   = Object.fromEntries(cats.map(c => [c, document.getElementById(`hdrsum-${c}`)]));

  // Targets form (tiles) – auto-kcal + auto-save
  const T = {
    kcal:   document.getElementById('target-kcal'),
    protein:document.getElementById('target-protein'),
    fat:    document.getElementById('target-fat'),
    satFat: document.getElementById('target-satFat'),
    carbs:  document.getElementById('target-carbs'),
    sugar:  document.getElementById('target-sugar'),
    fiber:  document.getElementById('target-fiber'),
    salt:   document.getElementById('target-salt'),
  };
  const targetsForm = document.getElementById('targetsForm');
  const resetDayBtn = document.getElementById('resetBtn');

  function autoKcal() {
    const P = +T.protein.value || 0;
    const F = +T.fat.value || 0;
    const C = +T.carbs.value || 0;
    const Fi= +T.fiber.value || 0;
    const kcal = Math.round(P*4 + F*9 + Math.max(0,(C-Fi))*4 + Fi*2);
    T.kcal.value = kcal;
  }

  targetsForm?.addEventListener('input', () => {
    autoKcal();
    store.update({
      targets: {
        kcal:+T.kcal.value||0, protein:+T.protein.value||0, fat:+T.fat.value||0,
        satFat:+T.satFat.value||0, carbs:+T.carbs.value||0, sugar:+T.sugar.value||0,
        fiber:+T.fiber.value||0, salt:+T.salt.value||0
      }
    });
  });

  resetDayBtn?.addEventListener('click', () => {
    store.set(s => ({ ...s, day: { ...s.day, cards: [] }}));
  });

  // Add-from-library dialog
  const addDlg = document.getElementById('addToDayDialog');
  const addList = document.getElementById('addToDayList');
  const addType = document.getElementById('addToDayType');
  const addCat  = document.getElementById('addToDayCategory');
  const addSearch = document.getElementById('addToDaySearch');
  let currentAddCat = 'extra';

  document.getElementById('dayBoards')?.addEventListener('click', (e) => {
    const resetBtn = e.target.closest('.reset-cat');
    if (resetBtn) {
      const cat = resetBtn.dataset.reset;
      store.set(s => ({ ...s, day: { ...s.day, cards: s.day.cards.filter(c=>c.category!==cat) } }));
      return;
    }
    const addBtn = e.target.closest('.add-from-lib');
    if (addBtn) {
      currentAddCat = addBtn.dataset.cat || 'extra';
      renderAddList();
      try { addDlg.showModal(); } catch {}
    }
  });

  function renderAddList() {
    const q = (addSearch?.value || '').trim().toLowerCase();
    const type = addType?.value || 'all';
    const cat = addCat?.value || 'all';
    const items = store.get().library.items.filter(it => {
      if (type !== 'all' && (it.kind||'ingredient') !== type) return false;
      if (cat !== 'all'  && it.category !== cat) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
    addList.innerHTML = items.map(it => `
      <button type="button" class="picker-item" data-id="${it.id}">
        <strong>${esc(it.name)}</strong>
        <small>${(it.kind||'ingredient')} • ${it.category} • ${Math.round(it.per100.kcal)} kcal/100 ${it.unit}</small>
      </button>
    `).join('') || `<p class="hint">No matches.</p>`;
  }
  [addType, addCat, addSearch].forEach(el => el?.addEventListener('input', renderAddList));
  addList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.picker-item'); if (!btn) return;
    const it = store.get().library.items.find(x=>x.id===btn.dataset.id); if (!it) return;
    const card = Core.models.makeDayCardFromLibrary(it, currentAddCat, 0);
    store.set(s => ({ ...s, day: { ...s.day, cards: [...s.day.cards, card] } }));
    addDlg?.close?.();
  });

  function render() {
    const state = store.get();
    // populate targets on first render
    Object.keys(T).forEach(k => { if (T[k] && T[k].value === '') T[k].value = state.targets[k] ?? ''; });
    autoKcal();

    cats.forEach(cat => {
      const host = containers[cat]; if (!host) return;
      const cards = state.day.cards.filter(c => c.category===cat).sort((a,b)=>(a.order??0)-(b.order??0));
      host.innerHTML = cards.map(cardHTML).join('');
      writeHdr(cat, Core.nutrition.totals(cards), cards.length);
    });

    wireCardEvents();
    renderDailySummary(state);
  }

  function cardHTML(c) {
    const p100 = withKcal(c.per100);
    const m = Core.nutrition.scaled(p100, c.amount||0);
    return `
      <article class="food-card" data-id="${c.id}" data-cat="${c.category}">
        <header class="food-card__head">
          <h4>${esc(c.name)}</h4>
          <button class="btn btn-ghost btn-small delete-card">Delete</button>
        </header>
        <div class="food-card__meta">
          <small>Per 100 ${c.unit} — ${Math.round(p100.kcal)} kcal • P ${p100.protein||0}g • F ${p100.fat||0}g • Sat ${p100.satFat||0}g • C ${p100.carbs||0}g • S ${p100.sugar||0}g • Fiber ${p100.fiber||0}g • Salt ${p100.salt||0}g</small>
        </div>
        <label class="food-card__amount">Amount
          <span class="food-card__amount-val">${c.amount||0} ${c.unit}</span>
          <input class="amount-slider" type="range" min="0" max="${c.max||1000}" step="1" value="${c.amount||0}">
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
  const r1 = n=>Core.nutrition.round1(n);
  const esc = (s='')=>s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const withKcal = p => ({ ...p, kcal: p?.kcal ?? Math.round(Core.nutrition.kcalFromMacros(p)) });

  function wireCardEvents() {
    cats.forEach(cat=>{
      const host = containers[cat]; if (!host) return;

      host.querySelectorAll('.food-card').forEach(card=>{
        const id = card.dataset.id;
        const slider = card.querySelector('.amount-slider');
        const out    = card.querySelector('.food-card__amount-val');
        const grid   = card.querySelector('.food-card__grid');

        // LIVE updates (no store.set → smooth)
        slider?.addEventListener('input', () => {
          const v = Number(slider.value)||0;
          out && (out.textContent = `${v} ${unitOf(id)}`);

          // recalc card values locally
          const c = store.get().day.cards.find(x=>x.id===id);
          if (!c) return;
          const p100 = withKcal(c.per100);
          const m = Core.nutrition.scaled(p100, v);
          grid.innerHTML = `
            ${macro('Kcal', Math.round(m.kcal))}
            ${macro('Protein', r1(m.protein))}
            ${macro('Fat',     r1(m.fat))}
            ${macro('Sat fat', r1(m.satFat))}
            ${macro('Carbs',   r1(m.carbs))}
            ${macro('Sugar',   r1(m.sugar))}
            ${macro('Fiber',   r1(m.fiber))}
            ${macro('Salt',    r1(m.salt))}
          `;

          // update header + daily summaries live (no store publish)
          liveSummaries(cat, id, v);
        });

        // COMMIT on change (one render)
        slider?.addEventListener('change', () => {
          const v = Number(slider.value)||0;
          store.set(s => {
            const cards = s.day.cards.map(x => x.id===id ? { ...x, amount: v } : x);
            return { ...s, day: { ...s.day, cards } };
          });
        });

        card.querySelector('.delete-card')?.addEventListener('click', () => {
          store.set(s => ({ ...s, day: { ...s.day, cards: s.day.cards.filter(x=>x.id!==id) }}));
        });
      });
    });
  }

  function liveSummaries(cat, id, tempAmount){
    // category header
    const state = store.get();
    const cards = state.day.cards.map(c => c.id===id ? { ...c, amount: tempAmount } : c)
                                 .filter(c => c.category===cat);
    writeHdr(cat, Core.nutrition.totals(cards), cards.length);

    // daily summary
    const all = state.day.cards.map(c => c.id===id ? { ...c, amount: tempAmount } : c);
    renderDailySummary({ day:{ cards: all }, targets: state.targets });
  }

  function writeHdr(cat, sum, count){
    const box = hdrBoxes[cat]; if (!box) return;
    if (!count) { box.innerHTML = ''; return; }
    box.innerHTML = [
      chip(`${Math.round(sum.kcal)} kcal`),
      chip(`P ${r1(sum.protein)}`),
      chip(`F ${r1(sum.fat)}`),
      chip(`Sat ${r1(sum.satFat)}`),
      chip(`C ${r1(sum.carbs)}`),
      chip(`S ${r1(sum.sugar)}`),
      chip(`Fi ${r1(sum.fiber)}`),
      chip(`Sa ${r1(sum.salt)}`),
    ].join('');
  }
  const chip = txt => `<span class="chip">${txt}</span>`;

  function renderDailySummary(state) {
    const sum = Core.nutrition.totals(state.day.cards);
    const t = state.targets;
    write('#sum-kcal',   Math.round(sum.kcal));   pct('#sum-kcal-pct',   sum.kcal,   t.kcal);
    write('#sum-protein',r1(sum.protein));        pct('#sum-protein-pct',sum.protein,t.protein);
    write('#sum-fat',    r1(sum.fat));            pct('#sum-fat-pct',    sum.fat,    t.fat);
    write('#sum-satfat', r1(sum.satFat));         pct('#sum-satfat-pct', sum.satFat, t.satFat);
    write('#sum-carbs',  r1(sum.carbs));          pct('#sum-carbs-pct',  sum.carbs,  t.carbs);
    write('#sum-sugar',  r1(sum.sugar));          pct('#sum-sugar-pct',  sum.sugar,  t.sugar);
    write('#sum-fiber',  r1(sum.fiber));          pct('#sum-fiber-pct',  sum.fiber,  t.fiber);
    write('#sum-salt',   r1(sum.salt));           pct('#sum-salt-pct',   sum.salt,   t.salt);
  }
  function write(sel, val){ const el=document.querySelector(sel); if(el) el.textContent=val; }
  function pct(sel, v, t){ const el=document.querySelector(sel); if(!el) return; el.textContent = (t>0?Math.round((v/t)*100):0) + '%'; }
  const unitOf = id => store.get().day.cards.find(c=>c.id===id)?.unit || 'g';

  render();
  store.subscribe(render);
}
