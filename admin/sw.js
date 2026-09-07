const CACHE = 'gdprint-admin-v5-1';
const CORE = [
  './login.html',
  './manifest.webmanifest',
  './shared/css/design-system.css',
  './shared/css/app-shell.css',
  './shared/css/pwa-install.css',
  './shared/js/pwa-install.js',
  './img/logo-icon.png',
  './icons/admin-192.png',
  './icons/admin-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('gdprint-admin-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.includes('/admin/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./login.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(resp => {
    if (resp && resp.ok) caches.open(CACHE).then(cache => cache.put(req, resp.clone()));
    return resp;
  })));
});

self.addEventListener('push', event => {
  let d={title:'GDprint Admin',body:'Դուք ունեք նոր ծանուցում',url:'./admin/dashboard.html'};
  try{d={...d,...event.data.json()}}catch(e){if(event.data)d.body=event.data.text()}
  event.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'./icons/admin-192.png',badge:'./icons/admin-192.png',data:{url:d.url||'./admin/dashboard.html'},tag:'gdprint-'+Date.now()}));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./admin/dashboard.html',self.registration.scope).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus'in c){c.navigate(target);return c.focus()}}
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});
