
const CACHE_NAME = 'live-coin-signal-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // It's safer to cache only the essential, local files.
        // Caching cross-origin resources from CDNs can be complex and error-prone.
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // For navigation requests, use a network-first strategy with a cache fallback.
  // This ensures the app works correctly for deep links (avoiding 404s) and when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        // If the response is valid, return it. If it's an error (like 404), fall back to the cached app shell.
        return response.ok ? response : caches.match('./index.html');
      }).catch(() => {
        // If the network request fails entirely (e.g., offline), fall back to the cached app shell.
        return caches.match('./index.html');
      })
    );
  } else {
    // For all other requests (JS, CSS, images, etc.), use a cache-first strategy for performance.
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Serve from cache if available, otherwise fetch from the network.
          return response || fetch(event.request);
        })
    );
  }
});

// Clean up old caches on activation
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});