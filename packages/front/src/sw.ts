/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

// ── Precaching ──────────────────────────────────────────────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Navigation fallback ─────────────────────────────────────────────────────
// Serve the precached index.html for all navigation requests that don't
// target the API (SPA client-side routing).
const navigationHandler = createHandlerBoundToURL("/index.html");
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//],
  }),
);

// ── Workbox plugin: strip volatile query params from cache keys ─────────────
function stripParamsPlugin(...params: string[]) {
  return {
    cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      for (const p of params) {
        url.searchParams.delete(p);
      }
      return url.href;
    },
  };
}

// ── Thumbnails (CacheFirst, 30 days) ────────────────────────────────────────
registerRoute(
  /\/api\/drives\/.+\/photos\/.+\/thumbnail/,
  new CacheFirst({
    cacheName: "thumbnails-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      stripParamsPlugin("token", "_t"),
    ],
  }),
);

// ── Previews (CacheFirst, 7 days) ───────────────────────────────────────────
registerRoute(
  /\/api\/drives\/.+\/photos\/.+\/preview/,
  new CacheFirst({
    cacheName: "previews-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      stripParamsPlugin("token", "_t", "w", "h"),
    ],
  }),
);

// ── General API (NetworkFirst, 1 hour) ──────────────────────────────────────
registerRoute(
  /\/api\//,
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }),
    ],
  }),
);

// ── Auto-update lifecycle ───────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", () => {
  self.clients.claim();
});
