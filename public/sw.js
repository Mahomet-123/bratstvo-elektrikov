/**
 * ============================================
 * Модуль: sw (Service Worker)
 * Ответственность: Кэш оболочки приложения для работы офлайн
 * Зависимости: нет
 * ============================================
 */

const CACHE = 'bratstvo-v3';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'css/app.css',
  'js/app.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/**
 * Перехват запросов:
 *  - не-GET и чужие адреса (API, фото на Drive) — не наше дело, отдаём браузеру;
 *    иначе fetch в воркере падает на CORS и ломает загрузку картинок;
 *  - оболочка — из кэша, чтобы приложение открывалось без сети;
 *  - остальные файлы приложения — сначала сеть (свежая версия), при неудаче — кэш.
 */
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isShell = request.mode === 'navigate' || SHELL.some(path => url.pathname.endsWith(path.replace('./', '/'))) || url.pathname === '/';

  event.respondWith(
    (isShell
      ? caches.match(request).then(cached =>
          cached || fetch(request).then(network => {
            const copy = network.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
            return network;
          }))
      : fetch(request)
          .then(network => {
            if (network && network.ok) {
              const copy = network.clone();
              caches.open(CACHE).then(cache => cache.put(request, copy));
            }
            return network;
          })
          .catch(() => caches.match(request))
    ).catch(() => caches.match(request))
  );
});
