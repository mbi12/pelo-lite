const CACHE_NAME = 'itutor-standalone-v21';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css?v=21',
  '/css/styles.css',
  '/js/app.js?v=21',
  '/js/app.js',
  '/js/emblem.js',
  '/js/mediaViewer.js',
  '/js/offlineStore.js',
  '/js/defaultSeed.js',
  '/vendor/pdfjs/pdf.min.js',
  '/vendor/pdfjs/pdf.worker.min.js',
  '/samples/trig-identities-worksheet.pdf',
  '/samples/newton-pulley-diagram.svg',
  '/assets/itutor-official-flyer.jpg',
  '/icon.svg',
  '/manifest.webmanifest',
  '/assets/itutor-logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          OFFLINE_ASSETS.map((assetUrl) =>
            fetch(assetUrl, { cache: 'reload' }).then((res) => {
              if (res && res.ok) return cache.put(assetUrl, res);
              return null;
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  const isCodeOrDoc =
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js');

  event.respondWith(
    fetch(request, isCodeOrDoc ? { cache: 'no-cache' } : undefined)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request, { ignoreSearch: true })
          .then((cached) => cached || caches.match('/index.html'))
      )
  );
});
