// Dart – service worker: keeps the whole app available offline.
const CACHE = 'dart-v14';
const FILES = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icons/logo.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './fonts/space-grotesk-latin-400-normal.woff2', './fonts/space-grotesk-latin-ext-400-normal.woff2', './fonts/space-grotesk-latin-500-normal.woff2', './fonts/space-grotesk-latin-ext-500-normal.woff2', './fonts/space-grotesk-latin-700-normal.woff2', './fonts/space-grotesk-latin-ext-700-normal.woff2',
  
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive when online), cache as fallback when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch:true }).then(r => r || caches.match('./index.html')))
  );
});
