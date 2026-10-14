const CACHE_NAME = 'finance-pro-v4';
const LOGO_URL = 'https://files.catbox.moe/gdnebi.png';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  LOGO_URL,
  'https://d3js.org/d3.v7.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: LOGO_URL,
      badge: LOGO_URL,
      vibrate: [200, 100, 200]
    });
  }
});
