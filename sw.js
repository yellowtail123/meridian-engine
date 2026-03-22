const CACHE_NAME='meridian-v8';
const APP_SHELL=[
  '/','/meridian.html','/meridian.css',
  '/meridian-core.js','/meridian-stats.js','/meridian-ui.js',
  '/meridian-data.js','/meridian-workshop.js','/meridian-features.js','/meridian-padi.js'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  // Cache-first for app shell (same-origin static files)
  if(url.origin===location.origin&&APP_SHELL.some(p=>url.pathname.endsWith(p.replace('/','')))){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
      const clone=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));return resp;
    })));
    return;
  }
  // Network-first for API calls and CDN resources
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
