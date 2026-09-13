const APP_VERSION="2.3";
let recipes=[], selected=new Set(JSON.parse(localStorage.getItem("salademenuSelectedV23")||"[]"));
let favorites=new Set(JSON.parse(localStorage.getItem("salademenuFavoritesV23")||"[]"));
let currentView="recipes", displayMode="grid";

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmt=n=>Number.isInteger(n)?String(n):String(Math.round(n*100)/100).replace(".",",");

async function init(){
  recipes=await fetch("recipes.json?v="+APP_VERSION).then(r=>r.json());
  buildFilters();
  bind();
  renderRecipes();
  renderPopularVegetables();
  updateSelectedCount();
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v="+APP_VERSION).catch(()=>{});
}
function buildFilters(){
  const counts=vegCounts();
  [...counts.keys()].sort((a,b)=>a.localeCompare(b,"nl")).forEach(v=>$("#vegFilter").add(new Option(v,v)));
}
function bind(){
  $("#searchInput").addEventListener("input",renderRecipes);
  $("#vegFilter").addEventListener("change",renderRecipes);
  $("#gridBtn").onclick=()=>setDisplay("grid");
  $("#listBtn").onclick=()=>setDisplay("list");
  $("#shoppingFull").onclick=()=>showView("shopping");
  $("#clearSelected").onclick=()=>{selected.clear();persist();renderAll();};
  $("#showAllVeg").onclick=()=>{$("#vegFilter").focus(); window.scrollTo({top:80,behavior:"smooth"});};
  $$(".nav-item,[data-nav]").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();showView(el.dataset.nav)}));
  $(".dialog-close").onclick=()=>$("#recipeDialog").close();
  $("#recipeDialog").addEventListener("click",e=>{if(e.target===$("#recipeDialog"))$("#recipeDialog").close();});
  $("#dialogSelect").onchange=e=>{toggleSelected(Number(e.target.dataset.id),e.target.checked);};
  $("#dialogFavorite").onclick=()=>{const id=Number($("#dialogFavorite").dataset.id);toggleFavorite(id);openRecipe(id);};
}
function showView(v){
  currentView=v;
  ["recipes","shopping","favorites","about"].forEach(name=>{
    $("#"+name+"View").hidden=name!==v;
  });
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.nav===v));
  if(v==="shopping")renderShoppingPage();
  if(v==="favorites")renderFavorites();
  window.scrollTo({top:0,behavior:"smooth"});
}
function setDisplay(mode){
  displayMode=mode;
  $("#recipeGrid").classList.toggle("list-mode",mode==="list");
  $("#gridBtn").classList.toggle("active",mode==="grid");
  $("#listBtn").classList.toggle("active",mode==="list");
}
function vegCounts(){
  const m=new Map();
  recipes.forEach(r=>r.vegetables.forEach(v=>m.set(v,(m.get(v)||0)+1)));
  return m;
}
function filteredRecipes(){
  const q=$("#searchInput").value.trim().toLowerCase(), v=$("#vegFilter").value;
  return recipes.filter(r=>(!v||r.vegetables.includes(v))&&(!q||r.title.toLowerCase().includes(q)||r.ingredients.join(" ").toLowerCase().includes(q)));
}
function mainVeg(r){return r.vegetables[0]||"Salade";}
function servingText(r){
  const m=String(r.servings||"").match(/\d+/); return m?m[0]:"4";
}
function cardHTML(r){
  const fav=favorites.has(r.id), sel=selected.has(r.id);
  return `<article class="recipe-card">
    <div class="photo-wrap">
      <img class="recipe-photo" src="${r.image}" alt="${esc(r.title)}" loading="lazy" data-open="${r.id}">
      <button class="heart ${fav?"active":""}" data-fav="${r.id}" aria-label="Favoriet">${fav?"♥":"♡"}</button>
    </div>
    <div class="card-body">
      <h3 class="recipe-title" data-open="${r.id}">${esc(r.title)}</h3>
      <div class="meta">
        <span><span class="leafdot">🍃</span> ${esc(mainVeg(r))}</span>
        <span>🍴 ${servingText(r)}</span>
      </div>
      <div class="select-row">
        <label><input type="checkbox" data-select="${r.id}" ${sel?"checked":""}> Voeg toe aan boodschappen</label>
      </div>
      <button class="recipe-button" data-open="${r.id}">Bekijk recept →</button>
    </div>
  </article>`;
}
function wireCards(scope=document){
  scope.querySelectorAll("[data-open]").forEach(el=>el.onclick=()=>openRecipe(Number(el.dataset.open)));
  scope.querySelectorAll("[data-select]").forEach(el=>el.onchange=()=>toggleSelected(Number(el.dataset.select),el.checked));
  scope.querySelectorAll("[data-fav]").forEach(el=>el.onclick=e=>{e.stopPropagation();toggleFavorite(Number(el.dataset.fav));renderRecipes();if(currentView==="favorites")renderFavorites();});
}
function renderRecipes(){
  const rs=filteredRecipes();
  $("#resultCount").textContent=rs.length;
  $("#recipeGrid").innerHTML=rs.map(cardHTML).join("");
  $("#recipeGrid").classList.toggle("list-mode",displayMode==="list");
  wireCards($("#recipeGrid"));
  renderShoppingMini();
}
function renderPopularVegetables(){
  const counts=[...vegCounts()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"nl")).slice(0,8);
  $("#popularVeg").innerHTML=counts.map(([v,n])=>`<button class="veg-pill" data-veg="${esc(v)}">${esc(v)} <b>(${n})</b></button>`).join("");
  $("#popularVeg").querySelectorAll("[data-veg]").forEach(b=>b.onclick=()=>{$("#vegFilter").value=b.dataset.veg;renderRecipes();window.scrollTo({top:80,behavior:"smooth"});});
}
// Standaard basisvoorraad die niet op de boodschappenlijst komt.
const PANTRY_PATTERNS=[
  /\bzout\b/i, /\bpeper\b/i, /\bolijfolie\b/i, /\bbakolie\b/i,
  /\bzonnebloemolie\b/i, /\bplantaardige olie\b/i, /\bneutrale olie\b/i,
  /\bwater\b/i
];
function isPantryIngredient(name){
  return PANTRY_PATTERNS.some(rx=>rx.test(String(name||"")));
}
function aggregateShopping(){
  const totals=new Map();
  recipes.filter(r=>selected.has(r.id)).forEach(r=>r.shopping.filter(x=>!isPantryIngredient(x.name)).forEach(x=>{
    const key=x.name+"|||"+x.unit, q=Number(x.qty), old=totals.get(key)||{name:x.name,qty:0,unit:x.unit};
    if(Number.isFinite(q))old.qty+=q; totals.set(key,old);
  }));
  return [...totals.values()].sort((a,b)=>a.name.localeCompare(b.name,"nl"));
}
function renderShoppingMini(){
  updateSelectedCount();
  const arr=aggregateShopping(), empty=arr.length===0;
  $("#shoppingEmpty").hidden=!empty; $("#shoppingList").hidden=empty;
  $("#shoppingList").innerHTML=arr.slice(0,8).map(x=>`<div class="mini-row"><span>${esc(x.name)}</span><span class="qty">${fmt(x.qty)}</span><span class="unit">${esc(x.unit)}</span></div>`).join("");
  $("#shoppingFull").textContent=arr.length>8?`Bekijk volledige lijst (${arr.length})`:"Bekijk volledige lijst";
}
function renderShoppingPage(){
  const arr=aggregateShopping(), empty=arr.length===0;
  $("#shoppingPageEmpty").hidden=!empty; $("#shoppingPageList").hidden=empty;
  $("#shoppingPageList").innerHTML=empty?"":`<div class="shop-row"><span>Ingrediënt</span><span class="qty">Totaal</span><span class="unit">Eenheid</span></div>`+
    arr.map(x=>`<div class="shop-row"><span>${esc(x.name)}</span><span class="qty">${fmt(x.qty)}</span><span class="unit">${esc(x.unit)}</span></div>`).join("");
}
function renderFavorites(){
  const rs=recipes.filter(r=>favorites.has(r.id));
  $("#favoritesEmpty").hidden=rs.length>0;
  $("#favoriteGrid").innerHTML=rs.map(cardHTML).join("");
  wireCards($("#favoriteGrid"));
}
function openRecipe(id){
  const r=recipes.find(x=>x.id===id); if(!r)return;
  $("#dialogImage").src=r.image; $("#dialogImage").alt=r.title; $("#dialogTitle").textContent=r.title;
  $("#dialogServings").textContent=r.servings||""; $("#dialogVeg").innerHTML=r.vegetables.map(v=>`<span class="chip">${esc(v)}</span>`).join("");
  $("#dialogIngredients").innerHTML=r.ingredients.map(x=>`<li>${esc(x)}</li>`).join("");
  $("#dialogSteps").innerHTML=r.steps.map(x=>`<li>${esc(x)}</li>`).join("");
  const cb=$("#dialogSelect"); cb.dataset.id=id; cb.checked=selected.has(id);
  const fav=$("#dialogFavorite"); fav.dataset.id=id; fav.textContent=favorites.has(id)?"♥":"♡"; fav.classList.toggle("active",favorites.has(id));
  $("#recipeDialog").showModal();
}
function toggleSelected(id,on){on?selected.add(id):selected.delete(id);persist();renderAll();}
function toggleFavorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);persist();}
function persist(){
  localStorage.setItem("salademenuSelectedV23",JSON.stringify([...selected]));
  localStorage.setItem("salademenuFavoritesV23",JSON.stringify([...favorites]));
  updateSelectedCount();
}
function updateSelectedCount(){$("#selectedCount").textContent=selected.size;}
function renderAll(){renderRecipes();renderShoppingMini();if(currentView==="shopping")renderShoppingPage();if(currentView==="favorites")renderFavorites();}
init();
