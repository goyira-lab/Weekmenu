const CACHE="salademenu-v2.3";
const CORE=["./","index.html","styles.css?v=2.3","app.js?v=2.3","recipes.json","manifest.webmanifest",
"assets/icons/icon-192.png","assets/icons/icon-512.png","assets/icons/icon-maskable-512.png","assets/icons/apple-touch-icon.png","assets/icons/favicon.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{if(e.request.method==="GET"&&resp.ok){const cp=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return resp;}))));
