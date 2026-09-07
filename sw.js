const CACHE_NAME = 'nutrihome-v7';
const APP_SHELL = [
  './', './index.html', './styles.css?v=1.7.0', './nutrihome-core.js?v=1.7.0', './demo-data.js?v=1.7.0', './recipe-library.js?v=1.7.0', './recipe-estimator.js?v=1.7.0', './storage.js?v=1.7.0', './app.js?v=1.7.0', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-192-maskable.png',
  './icons/icon-512.png', './icons/icon-512-maskable.png', './og.png', './recipe-photo-atlas-v3.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).pathname.includes('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => 'focus' in client);
      return existing ? existing.focus() : self.clients.openWindow('./');
    })
  );
});
