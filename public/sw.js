// CapyGame 3D Service Worker - Offline PWA Caching Engine
// Respects relative subpath hosting across GitHub Pages root, PR previews, and local dev.

const SCOPE_PATH = new URL('./', self.location).pathname;
const CACHE_PREFIX = 'capygame-cache-';
const CACHE_GENERATION = 'v2';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_GENERATION}:${SCOPE_PATH}`;

const PRECACHE_RELATIVE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/capybara.webp',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
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

              // If this is index.html, discover and precache hashed Vite script & style bundles
              if (url.endsWith('/index.html') || url === new URL('./index.html', self.location).href) {
                const htmlText = await response.text();
                const bundleMatches = [...htmlText.matchAll(/(?:src|href)=["']?((?:\.\/)?assets\/[^"'\s>]+)["']?/g)];

                for (const match of bundleMatches) {
                  const relPath = match[1].startsWith('./') ? match[1] : './' + match[1];
                  const bundleUrl = new URL(relPath, self.location).href;
                  try {
                    const bundleResp = await fetch(bundleUrl, { cache: 'no-cache' });
                    if (bundleResp.ok) {
                      await cache.put(bundleUrl, bundleResp.clone());

                      // If this is a JS bundle, discover and precache any referenced worker/chunk/wasm assets
                      if (bundleUrl.endsWith('.js')) {
                        const jsText = await bundleResp.text();
                        const subAssetMatches = [
                          ...jsText.matchAll(
                            /(?:\.\/|\/)?assets\/([A-Za-z0-9._-]+\.(?:js|mjs|wasm))/g
                          ),
                        ];
                        const seenSubAssets = new Set();
                        for (const wm of subAssetMatches) {
                          const fileName = wm[1];
                          if (seenSubAssets.has(fileName)) continue;
                          seenSubAssets.add(fileName);
                          const workerUrl = new URL('./assets/' + fileName, self.location).href;
                          if (workerUrl === bundleUrl) continue;
                          const workerResp = await fetch(workerUrl, { cache: 'no-cache' });
                          if (workerResp.ok) {
                            await cache.put(workerUrl, workerResp);
                          }
                        }
                      }
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

      await self.skipWaiting();
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
          // Purge legacy un-scoped capy-cache-* entries or older generations of THIS scope only
          const isLegacyUnscoped = key.startsWith('capy-cache-');
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

      await self.clients.claim();
    })()
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests with http/https schemes
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

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

  // 1. Navigation requests (HTML document): Network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
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
          // Offline navigation fallback: try matching the requested URL, or fallback to index.html
          const cachedResponse =
            (await caches.match(request, { ignoreSearch: true })) ||
            (await caches.match(new URL('./index.html', self.location).href, { ignoreSearch: true })) ||
            (await caches.match(new URL('./', self.location).href, { ignoreSearch: true }));
          if (cachedResponse) {
            return cachedResponse;
          }
          throw networkError;
        }
      })()
    );
    return;
  }

  // 2. Vite dev virtual, source & dependency modules: Network-first online, Cache-fallback offline
  const isDevModule =
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@react-refresh') ||
    url.pathname.includes('/@fs/') ||
    url.pathname.includes('/@id/') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('/node_modules/') ||
    url.search.includes('worker_file') ||
    url.search.includes('import');

  if (isDevModule) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (response && response.status === 200) {
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

  // 3. Static assets & production bundles (JS, CSS, images, workers): Cache-first with network fallback
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached =
        (await cache.match(request)) ||
        (await cache.match(request.url)) ||
        (await cache.match(request, { ignoreSearch: true })) ||
        (await cache.match(request.url, { ignoreSearch: true }));
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);
        // Cache valid responses within our origin or opaque no-cors responses
        if (response && (response.status === 200 || response.type === 'opaque')) {
          try {
            await cache.put(request, response.clone());
          } catch (cacheErr) {
            console.warn('[ServiceWorker] Failed to cache asset response:', request.url, cacheErr);
          }
        }
        return response;
      } catch (err) {
        const fallback = await cache.match(request.url, { ignoreSearch: true });
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

