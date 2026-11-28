const CACHE = 'ritm-v1037-free-time-window';
const FILES = ['./', './index.html', './manifest.webmanifest', './time-engine.js?v=20261128-1', './quick-add-parser.js?v=20261128-1', './icons/icon-192.svg', './icons/icon-512.svg'];

self.addEventListener('install', event => {
  // Новая версия кеша принудительно загружает актуальный HTML при каждом релизе.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('ritm-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Для переходов и обновления страницы сначала берём свежую версию с сервера.
  // Если интернета нет, открываем сохранённую копию приложения.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', fresh.clone());
        }
        return fresh;
      } catch (error) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      if (fresh.ok) (await caches.open(CACHE)).put(request, fresh.clone());
      return fresh;
    } catch (error) {
      return Response.error();
    }
  })());
});
