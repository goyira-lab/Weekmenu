const APP_VERSION="2.1";
let recipes=[], selected=new Set(JSON.parse(localStorage.getItem("selectedRecipesV2")||"[]"));
const $=s=>document.querySelector(s);
const grid=$("#recipeGrid"), veg=$("#vegFilter"), search=$("#searchInput"), dlg=$("#recipeDialog");
const fmt=n=>Number.isInteger(n)?String(n):String(Math.round(n*100)/100).replace(".",",");

async function init(){
  recipes=await fetch("recipes.json?v="+APP_VERSION).then(r=>r.json());
  const vegetables=[...new Set(recipes.flatMap(r=>r.vegetables))].sort((a,b)=>a.localeCompare(b,"nl"));
  vegetables.forEach(v=>veg.add(new Option(v,v)));
  bind();render();updateSelectedCount();
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v="+APP_VERSION).catch(()=>{});
}
function bind(){
  veg.addEventListener("change",render);search.addEventListener("input",render);
  document.querySelectorAll(".navbtn").forEach(b=>b.onclick=()=>showView(b.dataset.view));
  $("#clearSelected").onclick=()=>{selected.clear();save();render();renderShopping();};
  $(".close").onclick=()=>dlg.close();
  dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close()});
  $("#dialogSelect").onchange=e=>{const id=Number(e.target.dataset.id);toggleSelected(id,e.target.checked);render();};
}
function showView(v){
  $("#menuView").hidden=v!=="menu";$("#shoppingView").hidden=v!=="shopping";
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
  if(v==="shopping")renderShopping();
}
function filtered(){
  const q=search.value.trim().toLowerCase(),vf=veg.value;
  return recipes.filter(r=>(!vf||r.vegetables.includes(vf))&&(!q||r.title.toLowerCase().includes(q)||r.ingredients.join(" ").toLowerCase().includes(q)));
}
function render(){
  const rs=filtered();$("#resultCount").textContent=rs.length;
  grid.innerHTML=rs.map(r=>`<article class="recipe-card">
    <img src="${r.image}" alt="${esc(r.title)}" loading="lazy" data-open="${r.id}">
    <div class="recipe-content">
      <div class="chips">${r.vegetables.map(v=>`<span class="chip">${esc(v)}</span>`).join("")}</div>
      <h3 data-open="${r.id}">${String(r.id).padStart(3,"0")}. ${esc(r.title)}</h3>
      <div class="card-actions">
        <label class="pick"><input type="checkbox" data-select="${r.id}" ${selected.has(r.id)?"checked":""}> Selecteer</label>
        <button class="openbtn" data-open="${r.id}">Recept</button>
      </div>
    </div></article>`).join("");
  grid.querySelectorAll("[data-open]").forEach(el=>el.onclick=()=>openRecipe(Number(el.dataset.open)));
  grid.querySelectorAll("[data-select]").forEach(el=>el.onchange=()=>toggleSelected(Number(el.dataset.select),el.checked));
}
function toggleSelected(id,on){on?selected.add(id):selected.delete(id);save();updateSelectedCount();}
function save(){localStorage.setItem("selectedRecipesV2",JSON.stringify([...selected]));updateSelectedCount();}
function updateSelectedCount(){$("#selectedCount").textContent=selected.size;}
function openRecipe(id){
  const r=recipes.find(x=>x.id===id);if(!r)return;
  $("#dialogImage").src=r.image;$("#dialogImage").alt=r.title;$("#dialogTitle").textContent=r.title;
  $("#dialogServings").textContent=r.servings||"";$("#dialogVeg").innerHTML=r.vegetables.map(v=>`<span class="chip">${esc(v)}</span>`).join("");
  $("#dialogIngredients").innerHTML=r.ingredients.map(x=>`<li>${esc(x)}</li>`).join("");
  $("#dialogSteps").innerHTML=r.steps.map(x=>`<li>${esc(x)}</li>`).join("");
  const cb=$("#dialogSelect");cb.dataset.id=id;cb.checked=selected.has(id);dlg.showModal();
}
function renderShopping(){
  const totals=new Map();
  recipes.filter(r=>selected.has(r.id)).forEach(r=>r.shopping.forEach(x=>{
    const key=x.name+"|||"+x.unit,old=totals.get(key)||{name:x.name,qty:0,unit:x.unit},q=Number(x.qty);
    if(Number.isFinite(q))old.qty+=q;totals.set(key,old);
  }));
  const arr=[...totals.values()].sort((a,b)=>a.name.localeCompare(b.name,"nl"));
  $("#shoppingEmpty").hidden=arr.length>0;$("#shoppingList").hidden=arr.length===0;
  $("#shoppingList").innerHTML=arr.length?`<div class="shopping-row"><span>Ingrediënt</span><span class="num">Totaal</span><span class="unit">Eenheid</span></div>`+
    arr.map(x=>`<div class="shopping-row"><span>${esc(x.name)}</span><span class="num">${fmt(x.qty)}</span><span class="unit">${esc(x.unit||"")}</span></div>`).join(""):"";
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
init();