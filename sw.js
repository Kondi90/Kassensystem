const CACHE = 'montessori-festkasse-shell-v21';
const FILES = ['./','./index.html','./styles.css','./app.js','./model.js','./storage.js','./pin.js','./usage.js','./report.js','./vendor/pdf-lib.min.js','./vendor/fontkit.min.js','./fonts/NotoSans-Regular.ttf','./fonts/NotoSans-Bold.ttf','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./logo.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('montessori-festkasse-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  // Cache only our explicit application files, never sign-in pages or unrelated responses.
  const known=FILES.map(p=>new URL(p,self.registration.scope).href);
  if(event.request.mode==='navigate' && url.href.startsWith(self.registration.scope)) {
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('./index.html'))||fetch(event.request)));return;
  }
  if(known.includes(url.href))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
});
