const CACHE_NAME = 'pelo-p40-v2';
const SHELL_ASSETS = ['/', '/index.html', '/css/styles.css', '/js/orb.js', '/js/hardware.js', '/js/app.js', '/icon.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api')) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
