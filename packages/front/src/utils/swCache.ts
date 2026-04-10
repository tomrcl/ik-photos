/**
 * Per-photo cache purge for the Workbox runtime caches populated by the PWA SW.
 *
 * The thumbnail / preview URLs served by the app include query parameters
 * (auth `token`, and for previews `w`/`h`), so the runtime cache keys vary
 * per-request. We cannot just `cache.delete(url)` against a canonical path —
 * we must walk `cache.keys()` and match by pathname.
 *
 * This keeps the purge minimal: only the two cache entries for the given
 * photo id are removed, leaving every other cached thumbnail/preview intact.
 */
export async function purgePhotoCache(
  kdriveId: number,
  photoId: string,
): Promise<void> {
  return purgePhotosCache(kdriveId, [photoId]);
}

/**
 * Bulk variant of `purgePhotoCache`. Opens each runtime cache once and walks
 * its keys once, deleting any request whose pathname matches a target photo.
 * O(N + K) where N is photoIds.length and K is the cache size — in contrast
 * to calling `purgePhotoCache` in a loop, which walks every key for every id.
 */
export async function purgePhotosCache(
  kdriveId: number,
  photoIds: string[],
): Promise<void> {
  if (typeof caches === "undefined") return;
  if (photoIds.length === 0) return;

  const thumbPaths = new Set<string>();
  const previewPaths = new Set<string>();
  for (const id of photoIds) {
    thumbPaths.add(`/api/drives/${kdriveId}/photos/${id}/thumbnail`);
    previewPaths.add(`/api/drives/${kdriveId}/photos/${id}/preview`);
  }

  const purge = async (cacheName: string, targets: Set<string>): Promise<void> => {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      await Promise.all(
        keys.map((req) => {
          try {
            const url = new URL(req.url);
            if (targets.has(url.pathname)) {
              return cache.delete(req);
            }
          } catch {
            // ignore malformed URLs
          }
          return undefined;
        }),
      );
    } catch {
      // best-effort: never throw
    }
  };

  await Promise.all([
    purge("thumbnails-cache", thumbPaths),
    purge("previews-cache", previewPaths),
  ]);
}
