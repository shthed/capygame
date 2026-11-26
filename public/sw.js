// CapyGame Service Worker - Offline PWA Caching Engine
// Respects relative subpath hosting across GitHub Pages root, PR previews, and local dev.

const SCOPE_PATH = new URL('./', self.location).pathname;
const CACHE_PREFIX = 'capygame-cache-';
const CACHE_GENERATION = 'v2';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_GENERATION}:${SCOPE_PATH}`;

const PRECACHE_RELATIVE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './privacy.html',
  './data/capytorio/recipe.lua',
  './data/capytorio/technology.lua',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/apple-touch-icon.png',
];

// Helper to resolve URLs relative to the service worker script location
function getAbsolutePrecacheUrls() {
  return PRECACHE_RELATIVE_URLS.map((rel) => new URL(rel, self.location).href);
}

// Guard against Nginx 502->200 /warmup.html pages ever being stored in Cache Storage
async function isWarmupOrAuthHtml(response) {
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return false;
  try {
    const text = await response.clone().text();
    return (
      text.includes('__aistudio_warmup_failed') ||
      text.includes('<title>Starting Server...</title>') ||
      text.includes('__cookie_check')
    );
  } catch {
    return false;
  }
}

// Installation: pre-cache application shell, sample assets, and discovered production bundles
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const urlsToCache = getAbsolutePrecacheUrls();

      await Promise.allSettled(
        urlsToCache.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok && !(await isWarmupOrAuthHtml(response))) {
              await cache.put(url, response.clone());

              // If this is index.html, discover and precache top-level hashed Vite entry bundles only.
              // Physics workers, Wasm, and lazy feature chunks are cached on demand by the fetch handler.
              if (url.endsWith('/index.html') || url === new URL('./index.html', self.location).href) {
                const htmlText = await response.text();
                const bundleMatches = [...htmlText.matchAll(/(?:src|href)=["']?((?:\.\/)?assets\/[^"'\s>]+)["']?/g)];

                for (const match of bundleMatches) {
                  const relPath = match[1].startsWith('./') ? match[1] : './' + match[1];
                  const bundleUrl = new URL(relPath, self.location).href;
                  try {
                    const bundleResp = await fetch(bundleUrl, { cache: 'default' });
                    if (bundleResp.ok) {
                      await cache.put(bundleUrl, bundleResp.clone());
                    }
                  } catch (bundleErr) {
                    console.warn('[ServiceWorker] Failed to cache discovered bundle:', bundleUrl, bundleErr);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[ServiceWorker] Failed to pre-cache:', url, err);
          }
        })
      );
    })()
  );
});

// Activation: purge older cache generations, clean any stale Vite dev entries, and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map((key) => {
          // Purge legacy un-scoped capy-cache-* entries (without scope suffix) or older generations of THIS scope only
          const isLegacyUnscoped = key.startsWith('capy-cache-') && !key.includes(':');
          const isSameScopeOlderGen =
            key.startsWith(CACHE_PREFIX) &&
            key.endsWith(`:${SCOPE_PATH}`) &&
            key !== CACHE_NAME;
          if (isLegacyUnscoped || isSameScopeOlderGen) {
            return caches.delete(key);
          }
          return undefined;
        })
      );

      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (preloadErr) {
          console.warn('[ServiceWorker] navigationPreload enable skipped:', preloadErr);
        }
      }

      await self.clients.claim();
    })()
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle same-origin GET requests with http/https schemes
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  // Never intercept Vite HMR ping or AI Studio proxy/auth endpoints
  if (
    url.pathname.includes('/__vite_ping') ||
    url.pathname.startsWith('/__aistudio') ||
    url.pathname.startsWith('/_aistudio') ||
    url.pathname.startsWith('/__cookie_check') ||
    url.pathname === '/warmup.html' ||
    url.pathname === '/forbidden.html'
  ) {
    return;
  }

  // 1. Navigation requests (HTML document): Navigation Preload -> Network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          let networkResponse = null;
          if (event.preloadResponse) {
            try {
              const preloaded = await event.preloadResponse;
              if (preloaded) {
                networkResponse = preloaded;
              }
            } catch {
              // Ignore preload rejection and fall through to standard network/offline handling
            }
          }
          if (!networkResponse) {
            networkResponse = await fetch(request);
          }
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            !(await isWarmupOrAuthHtml(networkResponse))
          ) {
            try {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(request, networkResponse.clone());
            } catch (cacheErr) {
              console.warn('[ServiceWorker] Failed to cache navigation response:', cacheErr);
            }
          }
          return networkResponse;
        } catch (networkError) {
          // Offline navigation fallback: scope lookup strictly to CACHE_NAME
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse =
            (await cache.match(request, { ignoreSearch: true })) ||
            (await cache.match(new URL('./index.html', self.location).href, { ignoreSearch: true })) ||
            (await cache.match(new URL('./', self.location).href, { ignoreSearch: true }));
          if (cachedResponse) {
            return cachedResponse;
          }
          throw networkError;
        }
      })()
    );
    return;
  }

  // 2. Vite dev modules & hot-editable Capytorio .lua definitions: Network-first online, Cache-fallback offline
  const isDevModule =
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@react-refresh') ||
    url.pathname.includes('/@fs/') ||
    url.pathname.includes('/@id/') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.endsWith('.lua') ||
    url.search.includes('worker_file') ||
    url.search.includes('import');

  if (isDevModule) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (response && response.status === 200 && !(await isWarmupOrAuthHtml(response))) {
            try {
              await cache.put(request, response.clone());
            } catch {
              // Ignored
            }
          }
          return response;
        } catch (err) {
          const cached =
            (await cache.match(request)) ||
            (await cache.match(request.url)) ||
            (await cache.match(request, { ignoreSearch: true })) ||
            (await cache.match(request.url, { ignoreSearch: true }));
          if (cached) return cached;
          if (url.pathname.includes('/@vite/client')) {
            return new Response('export {};', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' },
            });
          }
          throw err;
        }
      })()
    );
    return;
  }

  // 3. Static assets & production bundles (JS, CSS, images, workers): Exact cache-first online, search-relaxed offline fallback
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = (await cache.match(request)) || (await cache.match(request.url));
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);
        // Cache only valid same-origin 200 non-warmup responses
        if (
          response &&
          url.origin === self.location.origin &&
          response.status === 200 &&
          !(await isWarmupOrAuthHtml(response))
        ) {
          try {
            await cache.put(request, response.clone());
          } catch (cacheErr) {
            console.warn('[ServiceWorker] Failed to cache asset response:', request.url, cacheErr);
          }
        }
        return response;
      } catch (err) {
        const fallback =
          (await cache.match(request, { ignoreSearch: true })) ||
          (await cache.match(request.url, { ignoreSearch: true }));
        if (fallback) return fallback;
        throw err;
      }
    })()
  );
});

// Handle skip waiting messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

