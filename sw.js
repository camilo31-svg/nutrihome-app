importScripts('./recipe-image-list.js?v=1.9.1');
const CACHE_NAME = 'nutrihome-v10';
const APP_SHELL = [
  './', './index.html', './styles.css?v=1.9.1', './nutrihome-core.js?v=1.9.1', './demo-data.js?v=1.9.1', './recipe-library.js?v=1.9.1', './recipe-estimator.js?v=1.9.1', './storage.js?v=1.9.1', './app.js?v=1.9.1', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-192-maskable.png',
  './icons/icon-512.png', './icons/icon-512-maskable.png', './og.png', './recipe-families.js?v=1.9.1', './recipe-specials.js?v=1.9.1', './recipe-photos.js?v=1.9.1', './recipe-image-list.js?v=1.9.1'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([...APP_SHELL, ...self.RECIPE_IMAGE_URLS])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('nutrihome-') && key !== CACHE_NAME).map(key => caches.delete(key))))
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
