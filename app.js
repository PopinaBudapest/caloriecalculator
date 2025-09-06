/* ===== Categories ===== */
const CATEGORIES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch",     label: "Lunch" },
  { id: "snack",     label: "Snack" },
  { id: "dinner",    label: "Dinner" },
  { id: "extra",     label: "Extra" }
];
const CATEGORY_IDS = CATEGORIES.map(c => c.id);

/* ===== Targets ===== */
const TARGETS_KEY = "calorie_targets_v1";
const DEFAULT_TARGETS = { kcal:2000, protein:50, fat:70, satFat:20, carbs:260, sugar:90, fiber:30, salt:6 };
function loadTargets(){ try{const t=JSON.parse(localStorage.getItem(TARGETS_KEY)); if(t&&typeof t==="object")return {...DEFAULT_TARGETS,...t};}catch{} return {...DEFAULT_TARGETS}; }
function saveTargets(t){ localStorage.setItem(TARGETS_KEY, JSON.stringify(t)); }
const targets = loadTargets();

/* ===== Foods persistence ===== */
const KEY = "calorie_cards_v2";

/* Atwater kcal from macros (fiber 2 kcal/g, net carbs = carbs - fiber) */
const FIBER_KCAL_PER_G = 2;
const FACTORS = { protein:4, carbs:4, fat:9, alcohol:7 };
function kcalFromMacros(per100){
  const p=+per100.protein||0, f=+per100.fat||0, carbs=+per100.carbs||0, fiber=+per100.fiber||0, alc=+per100.alcohol||0;
  const netC = Math.max(0, carbs - fiber);
  return Math.round((p*FACTORS.protein + f*FACTORS.fat + netC*FACTORS.carbs + fiber*FIBER_KCAL_PER_G + alc*FACTORS.alcohol)*10)/10;
}

function defaultSeed(){
  const milk={id:uid(),category:"breakfast",order:0,name:"Milk (3.5%)",unit:"ml",max:1000,amount:250,
    per100:{protein:3.4,fat:3.6,satFat:2.3,carbs:4.8,sugar:4.8,fiber:0,salt:0.1}};
  milk.per100.kcal=kcalFromMacros(milk.per100);
  const rice={id:uid(),category:"lunch",order:0,name:"Rice (cooked)",unit:"g",max:500,amount:200,
    per100:{protein:2.7,fat:0.3,satFat:0.1,carbs:28,sugar:0.1,fiber:0.4,salt:0}};
  rice.per100.kcal=kcalFromMacros(rice.per100);
  return { cards:[milk,rice] };
}

function load(){
  let s; try{s=JSON.parse(localStorage.getItem(KEY));}catch{}
  if(s && Array.isArray(s.cards)){
    const idxByCat = Object.fromEntries(CATEGORY_IDS.map(id=>[id,0]));
    s.cards.forEach(c=>{
      if(!CATEGORY_IDS.includes(c.category)) c.category="extra";
      if(c.order===undefined) c.order=idxByCat[c.category]++ | 0;
      if(!c.per100) c.per100={};
      if(c.per100.satFat===undefined) c.per100.satFat=0;
      if(c.per100.fiber===undefined)  c.per100.fiber=0;
      if(c.per100.salt===undefined)   c.per100.salt=0;
      c.per100.kcal=kcalFromMacros(c.per100);
    });
  }
  return s ?? defaultSeed();
}
function save(state){ localStorage.setItem(KEY, JSON.stringify(state)); }

const state = load();

/* ===== Utils ===== */
const q=(s,el=document)=>el.querySelector(s);
function uid(){ return Math.random().toString(36).slice(2,9); }
const round1=n=>Math.round(n*10)/10;
const todayISODate=()=>new Date().toISOString().slice(0,10);
const pctOf=(v,t)=>t>0?Math.round((v/t)*100):0;
const UNITS={kcal:"kcal",protein:"g",fat:"g",satFat:"g",carbs:"g",sugar:"g",fiber:"g",salt:"g"};
const pretty=(k,n)=>k==="kcal"?Math.round(n):round1(n);

function scaled(per100, amount){
  const f=(amount||0)/100;
  return {
    kcal:(per100.kcal||0)*f,
    protein:(per100.protein||0)*f,
    fat:(per100.fat||0)*f,
    satFat:(per100.satFat||0)*f,
    carbs:(per100.carbs||0)*f,
    sugar:(per100.sugar||0)*f,
    fiber:(per100.fiber||0)*f,
    salt:(per100.salt||0)*f
  };
}
function totals(cards){
  return cards.reduce((a,c)=>{const m=scaled(c.per100,c.amount);
    a.kcal+=m.kcal;a.protein+=m.protein;a.fat+=m.fat;a.satFat+=m.satFat;a.carbs+=m.carbs;a.sugar+=m.sugar;a.fiber+=m.fiber;a.salt+=m.salt;return a;
  },{kcal:0,protein:0,fat:0,satFat:0,carbs:0,sugar:0,fiber:0,salt:0});
}

/* ===== Summary ===== */
const sumEl={kcal:q("#sum-kcal"),protein:q("#sum-protein"),fat:q("#sum-fat"),satFat:q("#sum-satfat"),carbs:q("#sum-carbs"),sugar:q("#sum-sugar"),fiber:q("#sum-fiber"),salt:q("#sum-salt")};
const pctEl={kcal:q("#sum-kcal-pct"),protein:q("#sum-protein-pct"),fat:q("#sum-fat-pct"),satFat:q("#sum-satfat-pct"),carbs:q("#sum-carbs-pct"),sugar:q("#sum-sugar-pct"),fiber:q("#sum-fiber-pct"),salt:q("#sum-salt-pct")};
function renderSummary(){
  const t=totals(state.cards);
  const set=(k,val)=>{sumEl[k].textContent=pretty(k,val);const tgt=targets[k];const pct=pctOf(val,tgt);pctEl[k].textContent=pct+"%";const msg=`${pct}% of daily target (${pretty(k,val)} ${UNITS[k]} / ${tgt} ${UNITS[k]})`;pctEl[k].title=msg;pctEl[k].setAttribute("aria-label",msg);};
  set("kcal",t.kcal);set("protein",t.protein);set("fat",t.fat);set("satFat",t.satFat);set("carbs",t.carbs);set("sugar",t.sugar);set("fiber",t.fiber);set("salt",t.salt);
}

/* ===== Meal subtotals row ===== */
const totalsContainers={breakfast:q("#totals-breakfast"),lunch:q("#totals-lunch"),snack:q("#totals-snack"),dinner:q("#totals-dinner"),extra:q("#totals-extra")};
function renderMealTotals(){
  const keys=["kcal","protein","carbs","fat"], labels={kcal:"Kcal",protein:"Protein",carbs:"Carbs",fat:"Fat"};
  Object.keys(totalsContainers).forEach(cat=>{
    const t=totals(state.cards.filter(c=>c.category===cat));
    totalsContainers[cat].innerHTML = keys.map(k=>{
      const val=pretty(k,t[k]); const pct=pctOf(t[k],targets[k]);
      const title=`${pct}% of daily target for ${labels[k]} (${val} ${UNITS[k]} / ${targets[k]} ${UNITS[k]})`;
      return `<div class="mini"><span>${labels[k]}</span><span><strong>${val}</strong><span class="pct-mini" title="${title}">${pct}%</span></span></div>`;
    }).join("");
  });
}

/* ===== Boards & cards ===== */
const containers={breakfast:q("#cards-breakfast"),lunch:q("#cards-lunch"),snack:q("#cards-snack"),dinner:q("#cards-dinner"),extra:q("#cards-extra")};

function renderAll(){
  Object.values(containers).forEach(el=>el.innerHTML="");
  const grouped=Object.fromEntries(CATEGORY_IDS.map(id=>[id,[]]));
  state.cards.forEach(c=>(grouped[c.category]||grouped.extra).push(c));
  Object.entries(grouped).forEach(([cat,arr])=>{
    arr.sort((a,b)=>(a.order??0)-(b.order??0) || a.name.localeCompare(b.name));
    arr.forEach(card=>containers[cat].append(renderCard(card)));
  });
  renderMealTotals();
  renderSummary();
  save(state);
  setupContainerDnD();
}

function renderCard(model){
  const card=document.createElement("article"); card.className="card"; card.dataset.id=model.id;

  const head=document.createElement("div"); head.className="card__head"; head.setAttribute("draggable","true");
  const title=document.createElement("div"); title.className="card__title"; title.textContent=model.name;
  const actions=document.createElement("div"); actions.className="card__actions";

  const editBtn=document.createElement("button"); editBtn.className="icon-btn"; editBtn.textContent="Modify";
  editBtn.addEventListener("click",(e)=>{e.stopPropagation();openDialogForEdit(model.id);});
  const delBtn=document.createElement("button"); delBtn.className="icon-btn"; delBtn.textContent="Delete";
  delBtn.addEventListener("click",(e)=>{e.stopPropagation(); const i=state.cards.findIndex(c=>c.id===model.id); if(i>=0){state.cards.splice(i,1); renderAll();}});

  actions.append(editBtn,delBtn); head.append(title,actions);

  const meta=document.createElement("div"); meta.className="card__meta";
  const catLabel=(CATEGORIES.find(c=>c.id===model.category)||{label:""}).label;
  const p=model.per100;
  meta.innerHTML=`${catLabel} • Per 100 ${model.unit} — ${p.kcal} kcal, P ${p.protein}g • F ${p.fat}g • Sat ${p.satFat??0}g<br>C ${p.carbs}g • S ${p.sugar}g • Fiber ${p.fiber??0}g • Salt ${p.salt??0}g`;

  const wrap=document.createElement("div"); wrap.className="card__slider";
  const row=document.createElement("div"); row.className="amount-row";
  const lbl=document.createElement("span"); lbl.textContent="Amount";
  const valEl=document.createElement("strong"); valEl.textContent=`${model.amount??0} ${model.unit}`;
  row.append(lbl,valEl);

  const range=document.createElement("input"); range.type="range"; range.min="0"; range.max=String(model.max??1000); range.step="5"; range.value=String(model.amount??0);

  const reads=document.createElement("div"); reads.className="readouts";
  function update(amount){
    const m=scaled(model.per100,amount); valEl.textContent=`${amount} ${model.unit}`;
    reads.innerHTML=`
      <div><span>Kcal</span><strong>${Math.round(m.kcal)}</strong></div>
      <div><span>Protein</span><strong>${round1(m.protein)}</strong></div>
      <div><span>Fat</span><strong>${round1(m.fat)}</strong></div>
      <div><span>Sat fat</span><strong>${round1(m.satFat)}</strong></div>
      <div><span>Carbs</span><strong>${round1(m.carbs)}</strong></div>
      <div><span>Sugar</span><strong>${round1(m.sugar)}</strong></div>
      <div><span>Fiber</span><strong>${round1(m.fiber)}</strong></div>
      <div><span>Salt</span><strong>${round1(m.salt)}</strong></div>`;
  }
  update(+range.value);
  range.addEventListener("input",e=>{model.amount=+e.target.value; update(model.amount); renderMealTotals(); renderSummary(); save(state);});

  // drag only from header
  head.addEventListener("dragstart",(e)=>{card.classList.add("dragging"); e.dataTransfer.setData("text/plain",model.id); e.dataTransfer.effectAllowed="move";});
  head.addEventListener("dragend",()=>{card.classList.remove("dragging"); syncOrderFromDOM(); renderMealTotals(); renderSummary();});

  wrap.append(row,range,reads); card.append(head,meta,wrap); return card;
}

/* ===== DnD ===== */
function setupContainerDnD(){
  Object.entries(containers).forEach(([cat,container])=>{
    const board=container.closest(".board");
    container.addEventListener("dragover",(e)=>{e.preventDefault(); board.classList.add("drag-over");
      const after=getDragAfterElement(container,e.clientY); const dragging=document.querySelector(".card.dragging"); if(!dragging)return;
      if(!after)container.appendChild(dragging); else container.insertBefore(dragging,after);
    });
    container.addEventListener("dragleave",()=>board.classList.remove("drag-over"));
    container.addEventListener("drop",(e)=>{e.preventDefault(); board.classList.remove("drag-over"); syncOrderFromDOM(); renderAll();});
  });
}
function getDragAfterElement(container,y){
  const els=[...container.querySelectorAll(".card:not(.dragging)")];
  return els.reduce((closest,child)=>{const box=child.getBoundingClientRect(); const offset=y-(box.top+box.height/2);
    if(offset<0 && offset>closest.offset) return {offset,element:child}; return closest;},{offset:Number.NEGATIVE_INFINITY,element:null}).element;
}
function syncOrderFromDOM(){
  const byId=new Map(state.cards.map(c=>[c.id,c]));
  Object.entries(containers).forEach(([cat,el])=>{
    [...el.children].forEach((child,idx)=>{const item=byId.get(child.dataset.id); if(item){item.category=cat; item.order=idx;}});
  });
  save(state);
}

/* ===== Dialog (Add/Edit) ===== */
const addBtn=q("#addFoodBtn"), dlg=q("#foodDialog"), form=q("#foodForm"), cancelBtn=q("#cancelBtn"), dialogTitle=q("#dialogTitle"), submitBtn=q("#submitBtn");
let editingId=null;

function nextOrderForCategory(cat){ let m=-1; state.cards.forEach(c=>{ if(c.category===cat && typeof c.order==="number") m=Math.max(m,c.order);}); return m+1; }

function openDialogForAdd(){
  editingId=null; form.reset(); clearInvalid(form);
  dialogTitle.textContent="Add Food"; submitBtn.textContent="Add";
  prepareKcalAutoField(); autoFillKcalFromMacros();
  dlg.showModal ? dlg.showModal() : dlg.setAttribute("open","");
}
function openDialogForEdit(id){
  const item=state.cards.find(c=>c.id===id); if(!item) return;
  editingId=id; clearInvalid(form);
  dialogTitle.textContent="Modify Food"; submitBtn.textContent="Save";
  form.name.value=item.name; form.category.value=item.category; form.unit.value=item.unit; form.max.value=item.max;
  form.protein.value=item.per100.protein; form.fat.value=item.per100.fat; form.satFat.value=item.per100.satFat||0;
  form.carbs.value=item.per100.carbs; form.sugar.value=item.per100.sugar; form.fiber.value=item.per100.fiber||0; form.salt.value=item.per100.salt||0;
  prepareKcalAutoField(); autoFillKcalFromMacros();
  dlg.showModal ? dlg.showModal() : dlg.setAttribute("open","");
}
addBtn.addEventListener("click",openDialogForAdd);
cancelBtn.addEventListener("click",()=>{ dlg.close ? dlg.close() : dlg.removeAttribute("open"); });

/* Validation helpers + kcal auto in dialog */
function markInvalid(input,msg){ input.classList.add("invalid"); if(msg) input.title=msg; }
function clearInvalid(scope){ [...scope.querySelectorAll(".invalid")].forEach(el=>el.classList.remove("invalid"));
  [...scope.querySelectorAll("input,select")].forEach(el=>{ if(el.title && !el.readOnly) el.title=""; }); }
const parseNum=v=>{const n=Number(v); return Number.isFinite(n)?n:NaN;};

function prepareKcalAutoField(){
  const kcal=form.kcal;
  kcal.readOnly=true; kcal.setAttribute("aria-readonly","true");
  kcal.addEventListener("beforeinput",e=>e.preventDefault());
  kcal.addEventListener("keydown",e=>{ if(e.key!=="Tab") e.preventDefault(); });
  kcal.addEventListener("paste",e=>e.preventDefault());
  ["protein","fat","carbs","fiber"].forEach(name=>{
    form[name].oninput=autoFillKcalFromMacros;
    form[name].onchange=autoFillKcalFromMacros;
  });
}
function autoFillKcalFromMacros(){
  const per100={
    protein: parseNum(form.protein.value) || 0,
    fat:     parseNum(form.fat.value) || 0,
    carbs:   parseNum(form.carbs.value) || 0,
    fiber:   parseNum(form.fiber.value) || 0
  };
  form.kcal.value = kcalFromMacros(per100);
}

function validateFoodForm(fd, formEl){
  const errs=[]; clearInvalid(formEl);
  const name=String(fd.get("name")||"").trim(); if(!name){errs.push("Name is required."); markInvalid(formEl.name,"Required");}
  const unit=String(fd.get("unit")); if(!["ml","g"].includes(unit)){errs.push("Unit must be ml or g."); markInvalid(formEl.unit,"Choose ml or g");}
  const category=String(fd.get("category")); if(!CATEGORY_IDS.includes(category)){errs.push("Category invalid."); markInvalid(formEl.category,"Invalid category");}
  const max=parseNum(fd.get("max")); if(!Number.isFinite(max)||max<1){errs.push("Slider max must be at least 1."); markInvalid(formEl.max,"Min 1");}

  const req=["protein","fat","satFat","carbs","sugar","fiber","salt"];
  const vals={}; req.forEach(k=>{const el=formEl[k]; const n=parseNum(fd.get(k)); if(!Number.isFinite(n)||n<0){errs.push(`${k} must be a number ≥ 0.`); markInvalid(el,"Must be ≥ 0");} else {vals[k]=n;}});
  if(Number.isFinite(vals.sugar)&&Number.isFinite(vals.carbs)&&vals.sugar>vals.carbs){errs.push("Sugar per 100 cannot exceed Carbs per 100."); markInvalid(formEl.sugar,"Sugar ≤ Carbs"); markInvalid(formEl.carbs,"Carbs ≥ Sugar");}
  if(Number.isFinite(vals.satFat)&&Number.isFinite(vals.fat)&&vals.satFat>vals.fat){errs.push("Sat fat per 100 cannot exceed Fat per 100."); markInvalid(formEl.satFat,"Sat fat ≤ Fat"); markInvalid(formEl.fat,"Fat ≥ Sat fat");}

  const kcal=kcalFromMacros({protein:vals.protein,fat:vals.fat,carbs:vals.carbs,fiber:vals.fiber});
  return { valid:errs.length===0, errs, values:{ name, category, unit, max, per100:{...vals,kcal} } };
}

form.addEventListener("input",(e)=>{const t=e.target; if(t.classList.contains("invalid")) t.classList.remove("invalid"); if(t.title && !t.readOnly) t.title="";});

form.addEventListener("submit",(e)=>{
  e.preventDefault();
  const fd=new FormData(form);
  const check=validateFoodForm(fd,form);
  if(!check.valid){ alert("Please fix the following:\n\n- "+check.errs.join("\n- ")); return; }
  const cat=check.values.category;

  if(editingId){
    const item=state.cards.find(c=>c.id===editingId);
    if(item){
      const prev=item.category;
      item.name=check.values.name; item.category=cat; item.unit=check.values.unit; item.max=check.values.max; item.per100={...check.values.per100};
      if(cat!==prev) item.order=nextOrderForCategory(cat);
    }
  }else{
    state.cards.push({ id:uid(), category:cat, order:nextOrderForCategory(cat), name:check.values.name, unit:check.values.unit, max:check.values.max, amount:0, per100:{...check.values.per100} });
  }

  dlg.close ? dlg.close() : dlg.removeAttribute("open");
  renderAll();
});

/* ===== Resets ===== */
q("#resetBtn").addEventListener("click",()=>{ state.cards.forEach(c=>c.amount=0); renderAll(); });
document.querySelectorAll(".reset-cat").forEach(btn=>btn.addEventListener("click",()=>{ const cat=btn.dataset.reset; state.cards.forEach(c=>{ if(c.category===cat) c.amount=0; }); renderAll(); }));

/* ===== Save/Load (optional) ===== */
const saveBtn=q("#saveFileBtn"), loadBtn=q("#loadFileBtn"), loadInput=q("#loadFileInput");
if (saveBtn && loadBtn){
  saveBtn.addEventListener("click",async ()=>{
    const payload=buildExportObject(); const filename=`calories_${todayISODate()}.json`;
    if(window.isSecureContext && "showSaveFilePicker" in window){
      try{ const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:"JSON",accept:{"application/json":[".json"]}}]}); const writable=await handle.createWritable(); await writable.write(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"})); await writable.close(); }
      catch(err){ if(err && err.name!=="AbortError") alert("Save failed: "+err.message); }
    }else{
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
  });
  loadBtn.addEventListener("click",async ()=>{
    if(window.isSecureContext && "showOpenFilePicker" in window){
      try{ const [handle]=await window.showOpenFilePicker({multiple:false,types:[{description:"JSON",accept:{"application/json":[".json"]}}]}); const file=await handle.getFile(); const text=await file.text(); handleImportedText(text); }
      catch(err){ if(err && err.name!=="AbortError") alert("Load failed: "+err.message); }
    }else{ loadInput.value=""; loadInput.click(); }
  });
  loadInput.addEventListener("change",async (e)=>{ const f=e.target.files&&e.target.files[0]; if(!f)return; handleImportedText(await f.text()); });
}

function buildExportObject(){ const t=totals(state.cards); return {version:10, exportedAt:new Date().toISOString(), totals:{kcal:Math.round(t.kcal), protein:round1(t.protein), fat:round1(t.fat), satFat:round1(t.satFat), carbs:round1(t.carbs), sugar:round1(t.sugar), fiber:round1(t.fiber), salt:round1(t.salt)}, cards:state.cards}; }
function handleImportedText(text){
  try{ const data=JSON.parse(text); validateImport(data);
    const idxByCat=Object.fromEntries(CATEGORY_IDS.map(id=>[id,0]));
    data.cards.forEach(c=>{ if(!c.per100)c.per100={}; if(!CATEGORY_IDS.includes(c.category)) c.category="extra";
      if(c.per100.satFat===undefined)c.per100.satFat=0; if(c.per100.fiber===undefined)c.per100.fiber=0; if(c.per100.salt===undefined)c.per100.salt=0;
      c.per100.kcal=kcalFromMacros(c.per100);
      if(c.order===undefined)c.order=idxByCat[c.category]++|0; });
    state.cards=JSON.parse(JSON.stringify(data.cards)); renderAll(); alert("Loaded successfully.");
  }catch(err){ alert("Invalid file: "+(err&&err.message?err.message:err)); }
}
function validateImport(obj){
  if(typeof obj!=="object"||obj===null) throw new Error("Root is not an object.");
  if(!Array.isArray(obj.cards)) throw new Error("Missing 'cards' array.");
  obj.cards.forEach((c,i)=>{const path=`cards[${i}]`;
    ["id","name","category","unit"].forEach(k=>{ if(typeof c[k]!=="string") throw new Error(`${path}.${k} must be a string`); });
    if(typeof c.max!=="number") throw new Error(`${path}.max must be a number`);
    if(typeof c.amount!=="number") throw new Error(`${path}.amount must be a number`);
    if(!c.per100||typeof c.per100!=="object") throw new Error(`${path}.per100 missing`);
    ["protein","fat","carbs","sugar"].forEach(k=>{ if(typeof c.per100[k]!=="number") throw new Error(`${path}.per100.${k} must be a number`); });
    ["satFat","fiber","salt","kcal"].forEach(k=>{ if(c.per100[k]!==undefined && typeof c.per100[k]!=="number") throw new Error(`${path}.per100.${k} must be a number if present`); });
    if(!CATEGORY_IDS.includes(c.category)) throw new Error(`${path}.category invalid`);
    if(!["ml","g"].includes(c.unit)) throw new Error(`${path}.unit must be 'ml' or 'g'`);
  });
}

/* ===== Targets form ===== */
const targetsForm=q("#targetsForm");
const targetsInputs={
  kcal:q("#target-kcal"),
  protein:q("#target-protein"),
  fat:q("#target-fat"),
  satFat:q("#target-satFat"),
  carbs:q("#target-carbs"),
  sugar:q("#target-sugar"),
  fiber:q("#target-fiber"),
  salt:q("#target-salt")
};

/* Fill form, enforce step=1 integers, kcal auto-calc & locked */
function populateTargetsForm() {
  Object.keys(targetsInputs).forEach(k=>{
    if(k==="kcal"){ return; }
    const el=targetsInputs[k];
    el.value = targets[k];
    el.step = "1";
    el.inputMode = "numeric";
    el.onchange = () => {
      const n = Math.max(0, Math.round(Number(el.value || 0)));
      el.value = String(n);
      autoTargetsKcal();
    };
  });
  autoTargetsKcal(); // compute kcal from macros

  const kcalEl = targetsInputs.kcal;
  kcalEl.readOnly = true;
  kcalEl.setAttribute("aria-readonly","true");
  kcalEl.addEventListener("beforeinput", e => e.preventDefault());
  kcalEl.addEventListener("keydown", e => { if (e.key !== "Tab") e.preventDefault(); });
  kcalEl.addEventListener("paste", e => e.preventDefault());
}
populateTargetsForm();

/* compute targets kcal from macros */
function autoTargetsKcal(){
  const p=Number(targetsInputs.protein.value)||0;
  const f=Number(targetsInputs.fat.value)||0;
  const c=Number(targetsInputs.carbs.value)||0;
  const fib=Number(targetsInputs.fiber.value)||0;
  const netC=Math.max(0,c-fib);
  const kcal=Math.round(p*4 + f*9 + netC*4 + fib*2);
  targetsInputs.kcal.value=kcal;
}

targetsForm.addEventListener("input",(e)=>{ const t=e.target; if(t.classList.contains("invalid")) t.classList.remove("invalid"); if(t.title) t.title=""; });

targetsForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const errs=[];
  Object.entries(targetsInputs).forEach(([k,el])=>{
    if(k==="kcal") return; // computed
    const n=Number(el.value);
    if(!Number.isFinite(n)||n<0){errs.push(`${k} must be a number ≥ 0.`); el.classList.add("invalid"); el.title="Must be ≥ 0";}
  });
  if(errs.length){ alert("Please fix targets:\n\n- "+errs.join("\n- ")); return; }
  ["protein","fat","satFat","carbs","sugar","fiber","salt"].forEach(k=>targets[k]=Number(targetsInputs[k].value));
  targets.kcal = Number(targetsInputs.kcal.value);
  saveTargets(targets);
  renderMealTotals(); renderSummary();
});

q("#resetTargetsBtn").addEventListener("click",()=>{
  Object.assign(targets,DEFAULT_TARGETS);
  saveTargets(targets);
  populateTargetsForm();
  renderMealTotals(); renderSummary();
});

/* ===== Boot ===== */
renderAll();
setupContainerDnD();

