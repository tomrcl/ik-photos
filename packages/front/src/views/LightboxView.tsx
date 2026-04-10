import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { previewUrl, streamUrl, thumbnailUrl, downloadPhoto, deletePhotos, rotatePhoto, type Photo, type MonthCount } from "../api/files.ts";
import { toggleFavorite as apiToggleFavorite } from "../api/favorites.ts";
import { formatDate } from "../utils/format.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { ConfirmModal } from "../components/ConfirmModal.tsx";
import { useMonthPhotos } from "../hooks/useMonthPhotos.ts";
import { purgePhotoCache } from "../utils/swCache.ts";

export function LightboxView({
  kdriveId,
  photoId,
}: {
  kdriveId: number;
  photoId: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { getMonthPhotos, loadMonth, reset: resetMonthPhotos } = useMonthPhotos(kdriveId);

  // Build siblings from all cached month photos in order
  const siblings = useMemo(() => {
    const monthCounts = queryClient.getQueryData<MonthCount[]>(["monthCounts", kdriveId]) ?? [];
    const all: Photo[] = [];
    for (const mc of monthCounts) {
      const photos = getMonthPhotos(mc.year, mc.month);
      if (photos) all.push(...photos);
    }
    return all;
  }, [queryClient, kdriveId, getMonthPhotos]);

  const [currentId, setCurrentId] = useState(photoId);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCached, setPreviewCached] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const currentIndex = siblings.findIndex((f) => f.id === currentId);
  const currentFile: Photo | undefined =
    currentIndex >= 0 ? siblings[currentIndex] : undefined;

  const isVideo = currentFile?.mediaType === "video";

  // Check favorite status
  useEffect(() => {
    const favs = queryClient.getQueryData<Set<string>>(["favorites", kdriveId]);
    if (favs) {
      setIsFavorite(favs.has(currentId));
    }
  }, [currentId, kdriveId, queryClient]);

  // Prefetch adjacent months when approaching edges
  useEffect(() => {
    if (currentIndex < 0 || !currentFile) return;
    const monthCounts = queryClient.getQueryData<MonthCount[]>(["monthCounts", kdriveId]) ?? [];
    const curDate = new Date(currentFile.takenAt ?? currentFile.lastModifiedAt);
    const curYear = curDate.getFullYear();
    const curMonth = curDate.getMonth() + 1;
    const mcIdx = monthCounts.findIndex((mc) => mc.year === curYear && mc.month === curMonth);
    if (mcIdx < 0) return;

    // Check if near beginning of this month's photos
    const monthPhotos = getMonthPhotos(curYear, curMonth);
    if (monthPhotos) {
      const posInMonth = monthPhotos.findIndex((p) => p.id === currentId);
      if (posInMonth <= 2 && mcIdx > 0) {
        const prev = monthCounts[mcIdx - 1];
        loadMonth(prev.year, prev.month);
      }
      if (posInMonth >= monthPhotos.length - 3 && mcIdx < monthCounts.length - 1) {
        const next = monthCounts[mcIdx + 1];
        loadMonth(next.year, next.month);
      }
    }
  }, [currentId, currentIndex, currentFile, queryClient, kdriveId, getMonthPhotos, loadMonth]);

  const bustUrl = (url: string) => cacheBuster ? `${url}&_t=${cacheBuster}` : url;

  // Start with thumbnail, upgrade to preview (images only)
  useEffect(() => {
    if (isVideo) { setShowPreview(false); setPreviewCached(false); return; }
    const img = new Image();
    img.src = bustUrl(previewUrl(kdriveId, currentId));
    if (img.complete && img.naturalWidth > 0) {
      setPreviewCached(true);
      setShowPreview(true);
    } else {
      setPreviewCached(false);
      setShowPreview(false);
      img.onload = () => setShowPreview(true);
    }
  }, [currentId, kdriveId, isVideo, cacheBuster]);

  // Preload previous and next previews once current preview is ready
  useEffect(() => {
    if (!showPreview || siblings.length <= 1 || currentIndex < 0) return;
    const toPreload: Photo[] = [];
    const prevIndex = (currentIndex - 1 + siblings.length) % siblings.length;
    const nextIndex = (currentIndex + 1) % siblings.length;
    if (siblings[prevIndex].mediaType !== "video") toPreload.push(siblings[prevIndex]);
    if (nextIndex !== prevIndex && siblings[nextIndex].mediaType !== "video") toPreload.push(siblings[nextIndex]);
    for (const photo of toPreload) {
      const img = new Image();
      img.src = previewUrl(kdriveId, photo.id);
    }
  }, [showPreview, siblings, currentIndex, kdriveId]);

  const goBack = useCallback(() => {
    history.back();
  }, []);

  const navigatePhoto = useCallback(
    (delta: number) => {
      if (siblings.length === 0 || currentIndex < 0) return;
      const newIndex =
        (currentIndex + delta + siblings.length) % siblings.length;
      const file = siblings[newIndex];
      setCurrentId(file.id);
      // Reset zoom when changing photo
      setZoomScale(1);
      setZoomTranslate({ x: 0, y: 0 });
      history.replaceState(null, "", `#drive/${kdriveId}/photo/${file.id}`);
    },
    [siblings, currentIndex, kdriveId],
  );

  const handleRotate = async () => {
    setRotating(true);
    try {
      await rotatePhoto(kdriveId, currentId);
      // Drop just this photo's thumbnail/preview from the SW runtime cache so
      // the next fetch returns the rotated bytes instead of a stale CacheFirst
      // hit. Other photos stay cached.
      await purgePhotoCache(kdriveId, currentId);
      const ts = Date.now();
      setCacheBuster(ts);
      // Store cache buster so gallery thumbnails also refresh
      const busters = queryClient.getQueryData<Record<string, number>>(["cacheBusters"]) ?? {};
      queryClient.setQueryData(["cacheBusters"], { ...busters, [currentId]: ts });
      resetMonthPhotos();
    } catch (e) {
      console.error("Rotate failed", e);
    } finally {
      setRotating(false);
    }
  };

  const handleToggleFavorite = async () => {
    try {
      const result = await apiToggleFavorite(kdriveId, currentId);
      setIsFavorite(result.favorited);
      // Update cache
      const favs = queryClient.getQueryData<Set<string>>(["favorites", kdriveId]) ?? new Set();
      const next = new Set(favs);
      if (result.favorited) {
        next.add(currentId);
      } else {
        next.delete(currentId);
      }
      queryClient.setQueryData(["favorites", kdriveId], next);
    } catch (e) {
      console.error("Toggle favorite failed", e);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePhotos(kdriveId, [currentId]);
      await purgePhotoCache(kdriveId, currentId);
      await queryClient.invalidateQueries({ queryKey: ["monthCounts", kdriveId] });
      resetMonthPhotos();
      await queryClient.invalidateQueries({ queryKey: ["drives"] });
      await queryClient.invalidateQueries({ queryKey: ["favoritePhotos", kdriveId] });
      await queryClient.invalidateQueries({ queryKey: ["memories", kdriveId] });
      setShowDeleteConfirm(false);

      // Navigate to next photo or close lightbox
      if (siblings.length <= 1) {
        goBack();
      } else {
        const nextIndex = currentIndex >= siblings.length - 1 ? currentIndex - 1 : currentIndex;
        const nextPhoto = siblings.filter(p => p.id !== currentId)[Math.min(nextIndex, siblings.length - 2)];
        if (nextPhoto) {
          setCurrentId(nextPhoto.id);
          history.replaceState(null, "", `#drive/${kdriveId}/photo/${nextPhoto.id}`);
        } else {
          goBack();
        }
      }
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (showDeleteConfirm) return;
      if (e.key === "Escape") goBack();
      if (e.key === "ArrowLeft") navigatePhoto(-1);
      if (e.key === "ArrowRight") navigatePhoto(1);
      if (e.key === "i" || e.key === "I") setShowInfo((v) => !v);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [goBack, navigatePhoto, showDeleteConfirm]);

  // --- Pinch zoom + swipe ---
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomTranslate, setZoomTranslate] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartScale.current = zoomScale;
      setIsPinching(true);
      touchStart.current = null;
    } else if (e.touches.length === 1) {
      if (zoomScale > 1) {
        // Pan start when zoomed
        panStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          tx: zoomTranslate.x,
          ty: zoomTranslate.y,
        };
        touchStart.current = null;
      } else {
        // Swipe start
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStart.current = null;
      }
    }
  }, [zoomScale, zoomTranslate]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(5, Math.max(1, pinchStartScale.current * (dist / pinchStartDist.current)));
      setZoomScale(newScale);
      if (newScale === 1) {
        setZoomTranslate({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && panStart.current && zoomScale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setZoomTranslate({
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
      });
    }
  }, [zoomScale]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (pinchStartDist.current && e.touches.length < 2) {
      pinchStartDist.current = null;
      setIsPinching(false);
      // Snap to 1 if close
      if (zoomScale < 1.1) {
        setZoomScale(1);
        setZoomTranslate({ x: 0, y: 0 });
      }
      return;
    }

    if (panStart.current) {
      panStart.current = null;
      return;
    }

    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    // Only trigger swipe if not zoomed and horizontal swipe is dominant and long enough
    if (zoomScale <= 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigatePhoto(dx > 0 ? -1 : 1);
    }
  }, [navigatePhoto, zoomScale]);

  // Double-tap to toggle zoom
  const lastTap = useRef(0);
  const onDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      e.preventDefault();
      if (zoomScale > 1) {
        setZoomScale(1);
        setZoomTranslate({ x: 0, y: 0 });
      } else {
        setZoomScale(2.5);
      }
    }
    lastTap.current = now;
  }, [zoomScale]);

  // Note: zoom reset also happens in navigatePhoto() for swipe/arrow nav.
  // This useEffect covers the case where currentId changes externally (e.g. initial load).
  useEffect(() => {
    setZoomScale(1);
    setZoomTranslate({ x: 0, y: 0 });
  }, [currentId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) goBack();
      }}
    >
      {/* Top bar - always visible above zoom */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent shrink-0">
        <button
          onClick={goBack}
          className="text-white/80 hover:text-white text-sm cursor-pointer"
        >
          ✕ {t("lightbox.close")}
        </button>
        <div className="flex items-center gap-3">
          {currentFile && (
            <span className="text-white/70 text-sm hidden sm:inline">
              {formatDate(currentFile.takenAt ?? currentFile.lastModifiedAt)}
            </span>
          )}
          <button
            className={`cursor-pointer p-1 ${showInfo ? "text-blue-400" : "text-white/80 hover:text-white"}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowInfo((v) => !v);
            }}
            title={t("lightbox.info")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
          <button
            className={`cursor-pointer p-1 ${isFavorite ? "text-yellow-400" : "text-white/80 hover:text-white"}`}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite();
            }}
            title={t("lightbox.favorite")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </button>
          <button
            className="text-white/80 hover:text-white cursor-pointer p-1"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            title={t("delete.button")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
          {!isVideo && (
            <button
              className="text-white/80 hover:text-white cursor-pointer p-1 disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                handleRotate();
              }}
              disabled={rotating}
              title={t("lightbox.rotate")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6" />
                <path d="M21.34 15.57a10 10 0 1 1-.57-8.38L21.5 8" />
              </svg>
            </button>
          )}
          <button
            className="text-white/80 hover:text-white cursor-pointer p-1"
            onClick={(e) => {
              e.stopPropagation();
              downloadPhoto(kdriveId, currentId, currentFile?.name);
            }}
            title={t("lightbox.download")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image area — pinch zoom isolated here */}
      <div
        ref={imgContainerRef}
        className="flex-1 flex items-center justify-center w-full overflow-hidden relative"
        style={{ touchAction: "none" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) goBack();
        }}
        onTouchStart={(e) => { onDoubleTap(e); onTouchStart(e); }}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `scale(${zoomScale}) translate(${zoomTranslate.x / zoomScale}px, ${zoomTranslate.y / zoomScale}px)`,
            transformOrigin: "center center",
            transition: isPinching ? "none" : "transform 0.15s ease-out",
          }}
        >
          {isVideo ? (
            <video
              key={`video-${currentId}`}
              src={streamUrl(kdriveId, currentId)}
              poster={thumbnailUrl(kdriveId, currentId)}
              controls
              autoPlay
              className="object-contain w-full h-full"
            />
          ) : (
            <>
              {/* Thumbnail: only needed while preview is loading */}
              {!previewCached && (
                <img
                  key={`thumb-${currentId}-${cacheBuster}`}
                  src={bustUrl(thumbnailUrl(kdriveId, currentId))}
                  alt={currentFile?.name ?? ""}
                  className="object-contain absolute inset-0 w-full h-full"
                  draggable={false}
                />
              )}
              {/* Loading spinner while preview loads */}
              {!showPreview && (
                <div className="absolute bottom-4 right-4 z-10">
                  <svg className="animate-spin h-5 w-5 text-white/70" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
              {/* Preview: instant if cached, fade-in otherwise */}
              {showPreview && (
                <img
                  key={`preview-${currentId}-${cacheBuster}`}
                  src={bustUrl(previewUrl(kdriveId, currentId))}
                  alt={currentFile?.name ?? ""}
                  className={`object-contain absolute inset-0 w-full h-full${previewCached ? "" : " animate-fade-in"}`}
                  draggable={false}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Navigation arrows */}
      {siblings.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigatePhoto(-1);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white text-2xl cursor-pointer transition-colors"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigatePhoto(1);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white text-2xl cursor-pointer transition-colors"
          >
            ›
          </button>
        </>
      )}

      {showInfo && currentFile && (
        <PhotoInfoPanel photo={currentFile} onClose={() => setShowInfo(false)} />
      )}

      {rotating && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
          <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          message={t("delete.confirm", { count: 1 })}
          confirmLabel={t("delete.button")}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={deleting}
        />
      )}
    </div>
  );
}

function PhotoInfoPanel({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { t } = useI18n();

  // Build exposure string from available bits
  const exposureParts: string[] = [];
  if (photo.aperture != null) exposureParts.push(`f/${photo.aperture}`);
  if (photo.shutterSpeed) exposureParts.push(photo.shutterSpeed);
  if (photo.iso != null) exposureParts.push(`ISO ${photo.iso}`);
  if (photo.focalLength != null) exposureParts.push(`${Math.round(photo.focalLength)}mm`);
  const exposure = exposureParts.join(" · ");

  const camera = [photo.cameraMake, photo.cameraModel].filter(Boolean).join(" ").trim();
  const dimensions =
    photo.width != null && photo.height != null ? `${photo.width} × ${photo.height}` : null;
  const gps =
    photo.gpsLat != null && photo.gpsLng != null
      ? `${photo.gpsLat.toFixed(5)}, ${photo.gpsLng.toFixed(5)}`
      : null;

  const rows: { label: string; value: string }[] = [];
  // Only show the capture date when the photo actually has EXIF takenAt —
  // don't fall back to lastModifiedAt (file mtime) which would mislead the user.
  if (photo.takenAt) rows.push({ label: t("info.takenAt"), value: formatDate(photo.takenAt) });
  if (camera) rows.push({ label: t("info.camera"), value: camera });
  if (photo.lensModel) rows.push({ label: t("info.lens"), value: photo.lensModel });
  if (exposure) rows.push({ label: t("info.exposure"), value: exposure });
  if (dimensions) rows.push({ label: t("info.dimensions"), value: dimensions });
  if (gps) rows.push({ label: t("info.gps"), value: gps });

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-30 w-80 max-w-full bg-black/85 backdrop-blur-sm text-white border-l border-white/10 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h4 className="text-sm font-semibold uppercase tracking-wide">{t("info.title")}</h4>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white cursor-pointer p-1"
          title={t("lightbox.close")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <dl className="px-4 py-3 space-y-3 text-sm">
        {rows.length === 0 && (
          <p className="text-white/60 italic">{t("info.empty")}</p>
        )}
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs uppercase tracking-wide text-white/50">{row.label}</dt>
            <dd className="text-white mt-0.5 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
