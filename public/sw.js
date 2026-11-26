const CACHE_NAME = 'itutor-standalone-v27';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css?v=27',
  '/css/styles.css',
  '/js/app.js?v=27',
  '/js/app.js',
  '/js/emblem.js',
  '/js/mediaViewer.js',
  '/js/offlineStore.js',
  '/js/notifications.js',
  '/js/defaultSeed.js',
  '/vendor/pdfjs/pdf.min.js',
  '/vendor/pdfjs/pdf.worker.min.js',
  '/samples/trig-identities-worksheet.pdf',
  '/samples/newton-pulley-diagram.svg',
  '/assets/itutor-official-flyer.jpg',
  '/icon.svg',
  '/assets/icon-180.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find((item) => new URL(item.url).origin === self.location.origin);
    if (client) {
      await client.focus();
      client.postMessage({ type: 'OPEN_MESSAGES' });
    } else {
      await self.clients.openWindow('/?view=messages');
    }
  })());
});

// Push wakes this service worker even when there is no open page or polling.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { /* Generic safe alert. */ }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = windows.some((client) => client.visibilityState === 'visible');
    await self.registration.showNotification('i-tutor · New message', {
      body: 'Open i-tutor to read your new message.',
      icon: '/assets/icon-192.png', badge: '/icon.svg', tag: 'itutor-messages',
      silent: payload.sound === false || visible,
      data: { view: 'messages' }
    });
  })());
});
