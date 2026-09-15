/* 711 Admin service worker.
 *
 * Deliberately hand-rolled (no workbox): the project path contains an
 * apostrophe, which breaks workbox-build's generated imports, and the
 * strategy for an admin console is simple enough to not need a library.
 *
 * Caching strategy:
 *  - SPA navigations: network-first, falling back to the last cached
 *    index.html so the shell still opens when offline.
 *  - /assets/* (content-hashed build output): cache-first — a hashed
 *    filename can never go stale.
 *  - /icons/*, favicon, manifest: cache-first, they change rarely.
 *  - /api/* and every cross-origin request (API server, /uploads images,
 *    socket.io): passed straight through untouched. Admin data must never
 *    be served stale from a cache, and the SW must not interfere with the
 *    realtime socket.
 */

const RUNTIME_CACHE = "711-admin-runtime-v1";

self.addEventListener("install", () => {
  // Activate immediately after install; the next reload runs the new SW.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== RUNTIME_CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch other origins (API server, /uploads images, socket.io) or
  // the API itself — always let the network answer.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // SPA navigations: prefer the network so deploys land on the next load,
  // fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok && fresh.type === "basic") {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put("/index.html", fresh.clone());
          }
          return fresh;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = (await cache.match("/index.html")) || (await cache.match(request));
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Immutable-ish same-origin files: cache-first.
  const cacheFirstPrefixes = ["/assets/", "/icons/"];
  const cacheFirstFiles = ["/favicon.svg", "/manifest.webmanifest"];
  const isCacheFirst =
    cacheFirstPrefixes.some((prefix) => url.pathname.startsWith(prefix)) ||
    cacheFirstFiles.includes(url.pathname);
  if (!isCacheFirst) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return Response.error();
      }
    })(),
  );
});
