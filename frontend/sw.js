/**
 * Minimal service worker: caches static app-shell assets and falls back to
 * offline.html for page navigations made while there is no connection.
 * API calls are always network-only (never cached) so data stays fresh.
 */
const CACHE_NAME = 'cms-shell-v1';
const SHELL_ASSETS = [
  'offline.html',
  'assets/css/style.css',
  'assets/css/components.css',
  'assets/svg/icons.svg',
  'assets/js/config.js',
  'assets/js/api.js',
  'assets/js/toast.js',
  'assets/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Never cache API calls - always hit the network.
  if (request.url.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('offline.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
