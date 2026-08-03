// Passport Photo Studio service worker — offline app shell + runtime caching.
// Registered in production only (see main.tsx). Dependency-free / hand-written so we never precache
// the large WASM + segmentation model at install time; those are cached opportunistically on use.
const VERSION = "v1";
const SHELL_CACHE = `pps-shell-${VERSION}`;
const RUNTIME_CACHE = `pps-runtime-${VERSION}`;
const APP_SHELL = ["/", "/app", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually so a single 404 can't fail the whole install.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only handle same-origin — cross-origin (AdSense, fonts, etc.) passes straight through.
  if (url.origin !== self.location.origin) return;

  // SPA navigations: network-first, fall back to the cached app shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, response.clone()).catch(() => {});
          return response;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match("/app")) ||
            (await caches.match("/")) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});
