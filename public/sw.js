// Bump the name to purge older caches. (v2 stored a copy of every page, RSC payload and
// API response it saw and never pruned them — the cache only ever grew, and every
// navigation paid to clone and write its response.)
const CACHE_NAME = "twogether-static-v3";

// Content-hashed build output and app icons never change for a given URL, so they are
// safe to serve from cache forever. Everything else — pages, data, API calls — goes
// straight to the network untouched, so it is always fresh and never stored on-device.
const STATIC_PREFIXES = ["/_next/static/", "/icons/"];

self.addEventListener("install", () => {
  // Take over immediately without waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
