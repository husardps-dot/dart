// Dart – service worker: keeps the whole app available offline.
const CACHE = 'dart-v22';
const FILES = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icons/logo.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './fonts/space-grotesk-latin-400-normal.woff2', './fonts/space-grotesk-latin-ext-400-normal.woff2', './fonts/space-grotesk-latin-500-normal.woff2', './fonts/space-grotesk-latin-ext-500-normal.woff2', './fonts/space-grotesk-latin-700-normal.woff2', './fonts/space-grotesk-latin-ext-700-normal.woff2',
  
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache:'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive when online), cache as fallback.
// If the network hangs (weak Wi-Fi, slow GitHub), the saved copy is shown after 4 s instead of spinning forever.
const TIMEOUT = 4000;
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const cached = () => caches.match(e.request, { ignoreSearch:true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
  const net = fetch(e.request, { cache:'no-cache' }).then(r => {
    if (r && r.ok){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  });
  e.waitUntil(net.catch(() => {}));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const give = r => { if (!done && r){ done = true; resolve(r); return true; } return false; };
    const t = setTimeout(() => cached().then(give), TIMEOUT);
    net.then(r => { clearTimeout(t); give(r); })
       .catch(() => { clearTimeout(t); cached().then(r => give(r) || give(Response.error())); });
  }));
});
