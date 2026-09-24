const APP_VERSION="3.4";
let recipes=[], selected=new Set(JSON.parse(localStorage.getItem("weekmenuSelectedV34")||"[]"));
let favorites=new Set(JSON.parse(localStorage.getItem("weekmenuFavoritesV34")||"[]"));
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
    return ok && (!q || r.title.toLowerCase().includes(q) || (r.ingredients||[]).join(" ").toLowerCase().includes(q) || String(r.category||"").toLowerCase().includes(q));
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

const PHOTO_CACHE_KEY="weekmenuPhotoCacheV38";
let photoCache={};
try{photoCache=JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY)||"{}")}catch(e){photoCache={};}
async function fetchCommonsPhoto(r){
  if(r.image) return {url:r.image, source:"", license:"", artist:""};
  if(!r.sourcePage) return null;
  if(photoCache[r.id]) return photoCache[r.id];

  const api="https://nl.wikibooks.org/w/api.php?action=query&titles="+encodeURIComponent(r.sourcePage)+
    "&prop=pageimages&piprop=thumbnail|name|original&pithumbsize=1200&format=json&origin=*";
  try{
    const data=await fetch(api,{cache:"force-cache"}).then(x=>x.json());
    const page=Object.values((data.query&&data.query.pages)||{})[0];
    if(!page || !page.thumbnail || !page.thumbnail.source) throw new Error("geen bronfoto");
    let result={
      url:page.thumbnail.source,
      source:r.sourceUrl||"",
      license:"Licentie: controleer bronbestand",
      artist:"",
      fileTitle:page.pageimage||""
    };

    // Haal, indien beschikbaar, auteur en licentie van precies dit bronbestand op.
    if(page.pageimage){
      try{
        const fi="https://nl.wikibooks.org/w/api.php?action=query&titles="+encodeURIComponent("File:"+page.pageimage)+
          "&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*";
        const fd=await fetch(fi,{cache:"force-cache"}).then(x=>x.json());
        const fp=Object.values((fd.query&&fd.query.pages)||{})[0];
        const ii=fp&&fp.imageinfo&&fp.imageinfo[0];
        const md=(ii&&ii.extmetadata)||{};
        if(ii&&ii.descriptionurl) result.source=ii.descriptionurl;
        if(md.LicenseShortName&&md.LicenseShortName.value) result.license=md.LicenseShortName.value;
        if(md.Artist&&md.Artist.value) result.artist=md.Artist.value;
      }catch(e){}
    }
    if(result.license==="Licentie: controleer bronbestand")return null;
    photoCache[r.id]=result;
    localStorage.setItem(PHOTO_CACHE_KEY,JSON.stringify(photoCache));
    return result;
  }catch(e){return null;}
}
async function resolveRecipeImage(r,img,creditEl=null){
  if(r.image){
    img.src=r.image;
    if(creditEl) creditEl.textContent="";
    return;
  }
  const photo=await fetchCommonsPhoto(r);
  if(photo&&photo.url){
    img.src=photo.url;
    img.dataset.credit=photo.license||"bronfoto";
    img.dataset.source=photo.source||"";
    if(creditEl){
      const who=String(photo.artist||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
      creditEl.innerHTML='Foto: <a href="'+esc(photo.source||"#")+'" target="_blank" rel="noopener">bronfoto</a>'
        +(who?' · '+esc(who):'')+' · '+esc(photo.license||"vrije licentie");
    }
  }else if(creditEl){
    creditEl.textContent="Geen foto beschikbaar op de bronpagina.";
  }
}
function resolveVisibleImages(scope){
  scope.querySelectorAll("[data-recipe-image]").forEach(img=>{
    const r=recipes.find(x=>x.id===Number(img.dataset.recipeImage));
    if(r) resolveRecipeImage(r,img);
  });
}


const RECIPE_CACHE_KEY="weekmenuRecipeSourceCacheV38";
let sourceCache={};
try{sourceCache=JSON.parse(localStorage.getItem(RECIPE_CACHE_KEY)||"{}")}catch(e){sourceCache={};}

function cleanSourceText(s){
  return String(s||"").replace(/\[[0-9]+\]/g,"").replace(/\s+/g," ").trim();
}
async function loadSourceRecipe(r){
  if(!r.sourcePage) return r;
  if(sourceCache[r.id]){
    Object.assign(r,sourceCache[r.id]);
    return r;
  }
  const api="https://nl.wikibooks.org/w/api.php?action=parse&page="+encodeURIComponent(r.sourcePage)+
    "&prop=text&format=json&origin=*";
  try{
    const data=await fetch(api,{cache:"force-cache"}).then(x=>x.json());
    const html=data&&data.parse&&data.parse.text&&data.parse.text["*"];
    if(!html) throw new Error("geen broninhoud");
    const doc=new DOMParser().parseFromString(html,"text/html");

    const headingByText=needle=>[...doc.querySelectorAll("h2,h3,h4")].find(h=>h.textContent.toLowerCase().includes(needle));
    const collectLists=(heading, orderedOnly=false)=>{
      if(!heading)return [];
      const out=[];
      let el=heading.nextElementSibling;
      while(el && !/^H[234]$/.test(el.tagName)){
        const lists=[];
        if(["UL","OL"].includes(el.tagName)&&(!orderedOnly||el.tagName==="OL"))lists.push(el);
        lists.push(...el.querySelectorAll(orderedOnly?"ol":"ul,ol"));
        for(const list of lists)for(const li of list.children){
          if(li.tagName!=="LI")continue;
          const tx=cleanSourceText(li.textContent);
          if(tx&&!out.includes(tx))out.push(tx);
        }
        el=el.nextElementSibling;
      }
      return out;
    };
    let ing=collectLists(headingByText("ingrediënten")||headingByText("ingredients"));
    if(!ing.length)ing=collectLists(headingByText("ingrediënt")||headingByText("ingredient"));
    let steps=collectLists(headingByText("bereidingswijze")||headingByText("bereiding")||headingByText("procedure"),true);
    if(!steps.length)steps=collectLists(headingByText("werkwijze")||headingByText("method"),true);
    if(!steps.length)steps=collectLists(headingByText("instructies")||headingByText("directions"),true);
    if(!steps.length)steps=collectLists(headingByText("bereiding")||headingByText("preparation"),true);
    if(!steps.length)steps=collectLists(headingByText("stappen")||headingByText("instructions"),true);
    if(!steps.length){
      const h=headingByText("bereidingswijze")||headingByText("bereiding")||headingByText("procedure")||headingByText("werkwijze")||headingByText("method")||headingByText("instructies")||headingByText("directions")||headingByText("bereiding")||headingByText("preparation");
      if(h){let el=h.nextElementSibling;while(el&&!/^H[234]$/.test(el.tagName)){if(el.tagName==="P"&&cleanSourceText(el.textContent))steps.push(cleanSourceText(el.textContent));el=el.nextElementSibling;}}
    }
    const servingsText=[...doc.querySelectorAll("table")].map(x=>x.textContent).find(x=>/servings/i.test(x))||"";
    const sm=servingsText.match(/Servings\s*([0-9–\-]+)/i);

    if(!ing.length || !steps.length)throw new Error("Bron bevat geen automatisch uitleesbare ingrediënten of stappen");
    const loaded={
      ingredients:ing.length?ing:["Zie bronrecept voor ingrediënten."],
      steps:steps.length?steps:["Zie bronrecept voor bereidingswijze."],
      shoppingRaw:ing,
      servings:sm?sm[1]+" porties":"Volgens bron"
    };
    Object.assign(r,loaded);
    sourceCache[r.id]=loaded;
    localStorage.setItem(RECIPE_CACHE_KEY,JSON.stringify(sourceCache));
    return r;
  }catch(e){
    r.sourceLoadError=true;
    return r;
  }
}

function aggregateShopping(){
  const totals=new Map(), raw=[];
  recipes.filter(r=>selected.has(r.id)).forEach(r=>{
    if(r.shoppingRaw&&r.shoppingRaw.length){
      r.shoppingRaw.forEach(x=>raw.push({name:x,qty:"",unit:""}));
    }else{
      (r.shopping||[]).filter(x=>!isPantryIngredient(x.name)).forEach(x=>{
        const key=x.name+"|||"+x.unit, q=Number(x.qty), old=totals.get(key)||{name:x.name,qty:0,unit:x.unit};
        if(Number.isFinite(q))old.qty+=q; totals.set(key,old);
      });
    }
  });
  return [...totals.values(),...raw].sort((a,b)=>a.name.localeCompare(b.name,"nl"));
}
function renderShoppingMini(){
  updateSelectedCount();
  const arr=aggregateShopping(), empty=arr.length===0;
  $("#shoppingEmpty").hidden=!empty; $("#shoppingList").hidden=empty;
  $("#shoppingList").innerHTML=arr.slice(0,8).map(x=>`<div class="mini-row"><span>${esc(x.name)}</span><span class="qty">${x.qty===""?"":fmt(x.qty)}</span><span class="unit">${esc(x.unit)}</span></div>`).join("");
  $("#shoppingFull").textContent=arr.length>8?`Bekijk volledige lijst (${arr.length})`:"Bekijk volledige lijst";
}
function renderShoppingPage(){
  const arr=aggregateShopping(), empty=arr.length===0;
  $("#shoppingPageEmpty").hidden=!empty; $("#shoppingPageList").hidden=empty;
  $("#shoppingPageList").innerHTML=empty?"":`<div class="shop-row"><span>Ingrediënt</span><span class="qty">Totaal</span><span class="unit">Eenheid</span></div>`+
    arr.map(x=>`<div class="shop-row"><span>${esc(x.name)}</span><span class="qty">${x.qty===""?"":fmt(x.qty)}</span><span class="unit">${esc(x.unit)}</span></div>`).join("");
}
function renderFavorites(){
  const rs=recipes.filter(r=>favorites.has(r.id));
  $("#favoritesEmpty").hidden=rs.length>0;
  $("#favoriteGrid").innerHTML=rs.map(cardHTML).join("");
  wireCards($("#favoriteGrid"));
  resolveVisibleImages($("#favoriteGrid"));
}
async function openRecipe(id){
  const r=recipes.find(x=>x.id===id); if(!r)return;

  if(r.sourcePage) await loadSourceRecipe(r);
  if(r.sourceLoadError){window.open(r.sourceUrl,"_blank","noopener,noreferrer");return;}
  $("#dialogImage").src=r.image||"assets/icons/icon-512.png";
  $("#dialogImage").alt=r.title;
  resolveRecipeImage(r,$("#dialogImage"),$("#dialogPhotoCredit"));
  $("#dialogTitle").textContent=r.title;
  $("#dialogServings").textContent=r.servings||"";
  $("#dialogVeg").innerHTML=(r.vegetables||[]).map(v=>`<span class="chip">${esc(v)}</span>`).join("");
  $("#dialogIngredients").innerHTML=(r.ingredients||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  $("#dialogSteps").innerHTML=(r.steps||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  $("#dialogRecipeLicense").innerHTML=(r.sourceUrl?`Bron: <a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">Wikibooks Kookboek</a> · `:"")
    +esc(r.recipeLicense||"");
  const cb=$("#dialogSelect"); cb.dataset.id=id; cb.checked=selected.has(id);
  const fav=$("#dialogFavorite"); fav.dataset.id=id; fav.textContent=favorites.has(id)?"♥":"♡"; fav.classList.toggle("active",favorites.has(id));
  $("#recipeDialog").showModal();
}async function toggleSelected(id,on){
  const r=recipes.find(x=>x.id===id);

  if(on && r && r.sourcePage && !(r.shoppingRaw&&r.shoppingRaw.length)) await loadSourceRecipe(r);
  if(on && r && r.sourceLoadError){alert("Dit bronrecept kon niet worden ingelezen. Het is niet aan de boodschappenlijst toegevoegd.");return;}
  on?selected.add(id):selected.delete(id);
  persist();renderAll();
}
function toggleFavorite(id){favorites.has(id)?favorites.delete(id):favorites.add(id);persist();}
function persist(){
  localStorage.setItem("weekmenuSelectedV34",JSON.stringify([...selected]));
  localStorage.setItem("weekmenuFavoritesV34",JSON.stringify([...favorites]));
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
