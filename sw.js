const CACHE_NAME = 'night-vibe-online-pwa-v2';

const APP_SHELL_URLS = [
  './',
  './manifest.webmanifest',
  './app/config.js',
  './app/enemy.js',
  './app/game.js',
  './app/main.js',
  './app/network.js',
  './app/player.js',
  './app/projectile.js',
  './app/pwa.js',
  './app/ui.js',
  './app/utils.js',
  './app/nightvibe-gameplay-config.json',
  './assets/js/bson.bundle.js',
  './assets/js/tweakpane-1.5.7.min.js',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

const cacheRootAsIndex = async () => {
  const cache = await caches.open(CACHE_NAME);
  const rootResponse = await cache.match('./');
  if (rootResponse) {
    await cache.put('./index.html', rootResponse.clone());
  }
};

const INSTALL_URLS = [
  './',
  './manifest.webmanifest',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(INSTALL_URLS))
      .then(() => cacheRootAsIndex())
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'CACHE_APP_SHELL') return;

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => cacheRootAsIndex())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('./index.html', response.clone());
            if (url.pathname.endsWith('/')) {
              cache.put('./', response.clone());
            }
          });
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) return cached;

        return fetch(request);
      })
  );
});
