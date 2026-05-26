const CACHE_NAME = "twogether-v2";

// Static assets with content hashes — safe to cache indefinitely
const STATIC_ASSET_PREFIXES = ["/_next/static/", "/icons/", "/manifest.json"];

self.addEventListener("install", (event) => {
  // Take over immediately without waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clear all caches from previous versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (Supabase, Plaid, etc.)
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const isStaticAsset = STATIC_ASSET_PREFIXES.some((p) => url.pathname.startsWith(p));

  if (isStaticAsset) {
    // Cache-first for hashed static files — same URL always means same content
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return response;
          })
      )
    );
  } else {
    // Network-first for HTML pages — always fetches fresh HTML so the correct
    // (latest) JS bundle hashes are referenced. Falls back to cache when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
