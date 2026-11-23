const CACHE_NAME = 'nvBenz-v26';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './idb.js',
  './js/db.js',
  './js/model.js',
  './js/charts.js',
  './js/icons.js',
  './js/router.js',
  './js/views/home.js',
  './js/views/vehicles.js',
  './js/views/fillup.js',
  './js/views/stats.js',
  './js/views/import-export.js',
  './js/views/fillup-list.js',
  './js/views/settings.js',
  './js/views/more.js',
  './js/github.js',
  './js/app.js',
  './vendor/chart.js',
  './icons/favicon.svg',
  './icons/icon-180.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('nvBenz: some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache GitHub API calls — always network
  if (url.hostname === 'api.github.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for everything else; fall back to cache when offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone).catch(() => {});
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
