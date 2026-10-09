const CACHE_NAME = 'sentinel-ai-v4';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // External live APIs (Open Food Facts, Unsplash images, etc.) -> Network first with cache fallback
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // HTML navigation requests: Always NETWORK FIRST so users instantly get latest updates!
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request) || caches.match('./index.html') || caches.match('/sentinel-ai/index.html'))
    );
    return;
  }

  // JS / CSS / Assets: Cache first with Network background revalidate
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const networkFetch = fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const toCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, toCache));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || networkFetch;
    })
  );
});
