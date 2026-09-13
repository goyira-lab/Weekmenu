const APP_VERSION="2.7";
let recipes=[], selected=new Set(JSON.parse(localStorage.getItem("weekmenuSelectedV27")||"[]"));
let favorites=new Set(JSON.parse(localStorage.getItem("weekmenuFavoritesV27")||"[]"));
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
  if("serviceWorker" in navigator) setupAutoUpdate();
}
function buildFilters(){
  const values=new Set();
  recipes.forEach(r=>{
    if(r.category) values.add("Categorie: "+r.category);
    (r.vegetables||[]).forEach(v=>values.add("Groente: "+v));
  });
  [...values].sort((a,b)=>a.localeCompare(b,"nl")).forEach(v=>$("#vegFilter").add(new Option(v,v)));
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
  const q=$("#searchInput").value.trim().toLowerCase(), filter=$("#vegFilter").value;
  return recipes.filter(r=>{
    let ok=true;
    if(filter.startsWith("Categorie: ")) ok=r.category===filter.slice(11);
    else if(filter.startsWith("Groente: ")) ok=(r.vegetables||[]).includes(filter.slice(9));
    return ok && (!q || r.title.toLowerCase().includes(q) || r.ingredients.join(" ").toLowerCase().includes(q) || String(r.category||"").toLowerCase().includes(q));
  });
}
function mainVeg(r){return r.kind==="avondgerecht"?(r.category||"Avondgerecht"):((r.vegetables||[])[0]||"Salade");}
function servingText(r){
  const m=String(r.servings||"").match(/\d+/); return m?m[0]:"4";
}
function cardHTML(r){
  const fav=favorites.has(r.id), sel=selected.has(r.id);
  return `<article class="recipe-card">
    <div class="photo-wrap">
      <img class="recipe-photo" src="${r.image||"assets/icons/icon-512.png"}" alt="${esc(r.title)}" loading="lazy" data-recipe-image="${r.id}" data-open="${r.id}">
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
  resolveVisibleImages($("#recipeGrid"));
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

const PHOTO_CACHE_KEY="weekmenuPhotoCacheV27";
let photoCache={};
try{photoCache=JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY)||"{}")}catch(e){photoCache={};}
async function fetchCommonsPhoto(r){
  if(r.image) return {url:r.image};
  if(photoCache[r.id]) return photoCache[r.id];
  const q=encodeURIComponent((r.imageSearch||r.title)+" food");
  const api="https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch="+q+
    "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&format=json&origin=*";
  try{
    const data=await fetch(api,{cache:"force-cache"}).then(x=>x.json());
    const pages=Object.values((data.query&&data.query.pages)||{});
    const p=pages.find(x=>x.imageinfo&&x.imageinfo[0]&&x.imageinfo[0].thumburl);
    if(!p) throw new Error("geen foto");
    const ii=p.imageinfo[0], md=ii.extmetadata||{};
    const result={
      url:ii.thumburl,
      source:ii.descriptionurl||"",
      artist:(md.Artist&&md.Artist.value)||"",
      license:(md.LicenseShortName&&md.LicenseShortName.value)||"Wikimedia Commons"
    };
    photoCache[r.id]=result;
    localStorage.setItem(PHOTO_CACHE_KEY,JSON.stringify(photoCache));
    return result;
  }catch(e){return null;}
}
async function resolveRecipeImage(r,img){
  if(r.image){img.src=r.image;return;}
  const photo=await fetchCommonsPhoto(r);
  if(photo&&photo.url){
    img.src=photo.url;
    img.dataset.credit=(photo.license||"Wikimedia Commons");
    img.dataset.source=photo.source||"";
  }
}
function resolveVisibleImages(scope){
  scope.querySelectorAll("[data-recipe-image]").forEach(img=>{
    const r=recipes.find(x=>x.id===Number(img.dataset.recipeImage));
    if(r) resolveRecipeImage(r,img);
  });
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
  resolveVisibleImages($("#favoriteGrid"));
}
function openRecipe(id){
  const r=recipes.find(x=>x.id===id); if(!r)return;
  $("#dialogImage").src=r.image||"assets/icons/icon-512.png"; $("#dialogImage").alt=r.title; resolveRecipeImage(r,$("#dialogImage")); $("#dialogTitle").textContent=r.title;
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
  localStorage.setItem("weekmenuSelectedV27",JSON.stringify([...selected]));
  localStorage.setItem("weekmenuFavoritesV27",JSON.stringify([...favorites]));
  updateSelectedCount();
}
function updateSelectedCount(){$("#selectedCount").textContent=selected.size;}
function renderAll(){renderRecipes();renderShoppingMini();if(currentView==="shopping")renderShoppingPage();if(currentView==="favorites")renderFavorites();}

async function setupAutoUpdate(){
  try{
    const reg=await navigator.serviceWorker.register("sw.js?v="+APP_VERSION,{updateViaCache:"none"});
    const showUpdate=worker=>{
      if(!worker)return;
      $("#updateBanner").hidden=false;
      $("#updateNow").onclick=()=>{
        worker.postMessage({type:"SKIP_WAITING"});
        $("#updateNow").disabled=true;
        $("#updateNow").textContent="Vernieuwen…";
      };
    };
    if(reg.waiting) showUpdate(reg.waiting);
    reg.addEventListener("updatefound",()=>{
      const worker=reg.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed" && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });
    // Controleer bij starten, terugkeren naar de app en periodiek tijdens gebruik.
    reg.update().catch(()=>{});
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible") reg.update().catch(()=>{});
    });
    setInterval(()=>reg.update().catch(()=>{}),15*60*1000);
    let refreshing=false;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(refreshing)return;
      refreshing=true;
      location.reload();
    });
  }catch(e){
    console.warn("Updatecontrole niet beschikbaar",e);
  }
}

init();
