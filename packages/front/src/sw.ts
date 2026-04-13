/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
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

// Workbox's RegExp matcher only matches cross-origin URLs when the regex
// matches at index 0 of the full href. Our API runs on a different origin
// (e.g. :3004 vs front :3003 in dev), so we use function matchers against
// `url.pathname` to stay origin-agnostic.
const thumbnailRe = /^\/api\/drives\/[^/]+\/photos\/[^/]+\/thumbnail$/;
const previewRe = /^\/api\/drives\/[^/]+\/photos\/[^/]+\/preview$/;
const photosListRe = /^\/api\/drives\/[^/]+\/photos\/(months|years|memories|geo|all)$/;
const photosRootRe = /^\/api\/drives\/[^/]+\/photos$/;

function isPhotosList(url: URL): boolean {
  if (photosListRe.test(url.pathname)) return true;
  // Month photo list: /api/drives/{id}/photos?year=X&month=Y
  if (photosRootRe.test(url.pathname) && url.searchParams.has("year") && url.searchParams.has("month")) {
    return true;
  }
  return false;
}

// ── Thumbnails (CacheFirst, 30 days) ────────────────────────────────────────
registerRoute(
  ({ url }) => thumbnailRe.test(url.pathname),
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
  ({ url }) => previewRe.test(url.pathname),
  new CacheFirst({
    cacheName: "previews-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      stripParamsPlugin("token", "_t", "w", "h"),
    ],
  }),
);

// ── Photo list endpoints (StaleWhileRevalidate, 7 days) ────────────────────
// Serves instantly from cache on boot, then refreshes in background.
registerRoute(
  ({ url, request }) => request.method === "GET" && isPhotosList(url),
  new StaleWhileRevalidate({
    cacheName: "photos-list-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// ── General API (NetworkFirst, 1 hour) ──────────────────────────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
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
