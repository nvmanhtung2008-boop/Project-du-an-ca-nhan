/* ==========================================================================
   HÀ NỘI PHỐ VỊ — SERVICE WORKER (ES5)
   Offline caching & fast asset delivery for PWA
   ========================================================================== */
var CACHE_NAME = 'hanoi-phovi-pwa-v1';

var CORE_ASSETS = [
  './',
  './index.html',
  './games.html',
  './styles.css',
  './theme.js',
  './data.js',
  './utilities_i18n.js',
  './app.js',
  './billsplit.js',
  './order_booking.js',
  './smart_discovery.js',
  './community_engage.js',
  './pwa_seo.js',
  './movies.js',
  './games.js',
  './soulknight_hub.js',
  './boardgames.js',
  './manifest.json',
  './icon.svg'
];

function isCacheableResponse(res) {
  return res && (res.status === 200 || res.type === 'opaque');
}

function cacheAllResilient(cache) {
  return cache.addAll(CORE_ASSETS).catch(function () {
    return Promise.all(
      CORE_ASSETS.map(function (url) {
        return cache.add(url).catch(function () {
          return null;
        });
      })
    );
  });
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cacheAllResilient(cache);
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (!req || req.method !== 'GET') return;

  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  var isNavigation = req.mode === 'navigate' ||
    (req.headers && req.headers.get && (req.headers.get('accept') || '').indexOf('text/html') !== -1);

  if (isNavigation) {
    event.respondWith(
      fetch(req).then(function (networkRes) {
        if (isCacheableResponse(networkRes)) {
          var copy = networkRes.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return networkRes;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          if (cached) return cached;
          return caches.match('./index.html');
        });
      })
    );
    return;
  }

  var isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // Cache-First with background refresh for same-origin static assets
    event.respondWith(
      caches.match(req).then(function (cached) {
        var fetchPromise = fetch(req).then(function (networkRes) {
          if (isCacheableResponse(networkRes)) {
            var copy = networkRes.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, copy);
            });
          }
          return networkRes;
        }).catch(function () {
          return cached;
        });

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Network-First with cache fallback for external fonts/images/CDN
  event.respondWith(
    fetch(req).then(function (networkRes) {
      if (isCacheableResponse(networkRes)) {
        var copy = networkRes.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, copy);
        });
      }
      return networkRes;
    }).catch(function () {
      return caches.match(req);
    })
  );
});
