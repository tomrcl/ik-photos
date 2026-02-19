import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { previewUrl, streamUrl, thumbnailUrl, downloadPhoto, deletePhotos, type Photo, type MonthCount } from "../api/files.ts";
import { formatDate } from "../utils/format.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { ConfirmModal } from "../components/ConfirmModal.tsx";
import { useMonthPhotos } from "../hooks/useMonthPhotos.ts";

export function LightboxView({
  kdriveId,
  photoId,
}: {
  kdriveId: number;
  photoId: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { getMonthPhotos, loadMonth } = useMonthPhotos(kdriveId);

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

  const currentIndex = siblings.findIndex((f) => f.id === currentId);
  const currentFile: Photo | undefined =
    currentIndex >= 0 ? siblings[currentIndex] : undefined;

  const isVideo = currentFile?.mediaType === "video";

  // Prefetch adjacent months when approaching edges
  useEffect(() => {
    if (currentIndex < 0 || !currentFile) return;
    const monthCounts = queryClient.getQueryData<MonthCount[]>(["monthCounts", kdriveId]) ?? [];
    const curDate = new Date(currentFile.lastModifiedAt);
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

  // Start with thumbnail, upgrade to preview (images only)
  useEffect(() => {
    if (isVideo) { setShowPreview(false); setPreviewCached(false); return; }
    const img = new Image();
    img.src = previewUrl(kdriveId, currentId);
    if (img.complete && img.naturalWidth > 0) {
      setPreviewCached(true);
      setShowPreview(true);
    } else {
      setPreviewCached(false);
      setShowPreview(false);
      img.onload = () => setShowPreview(true);
    }
  }, [currentId, kdriveId, isVideo]);

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
      history.replaceState(null, "", `#drive/${kdriveId}/photo/${file.id}`);
    },
    [siblings, currentIndex, kdriveId],
  );

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePhotos(kdriveId, [currentId]);
      await queryClient.invalidateQueries({ queryKey: ["monthCounts"] });
      await queryClient.invalidateQueries({ queryKey: ["monthPhotos"] });
      await queryClient.invalidateQueries({ queryKey: ["drives"] });
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
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [goBack, navigatePhoto, showDeleteConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) goBack();
      }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent z-10">
        <button
          onClick={goBack}
          className="text-white/80 hover:text-white text-sm cursor-pointer"
        >
          ✕ {t("lightbox.close")}
        </button>
        <div className="flex items-center gap-4">
          {currentFile && (
            <span className="text-white/70 text-sm">
              {formatDate(currentFile.lastModifiedAt)}
            </span>
          )}
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

      {/* Image — thumbnail underneath, preview on top */}
      <div
        className="flex-1 flex items-center justify-center w-full overflow-hidden relative"
        onClick={(e) => {
          if (e.target === e.currentTarget) goBack();
        }}
      >
        {isVideo ? (
          <video
            key={`video-${currentId}`}
            src={streamUrl(kdriveId, currentId)}
            poster={thumbnailUrl(kdriveId, currentId)}
            controls
            autoPlay
            className="object-contain absolute inset-0 w-full h-full"
          />
        ) : (
          <>
            {/* Thumbnail: only needed while preview is loading */}
            {!previewCached && (
              <img
                key={`thumb-${currentId}`}
                src={thumbnailUrl(kdriveId, currentId)}
                alt={currentFile?.name ?? ""}
                className="object-contain absolute inset-0 w-full h-full"
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
                key={`preview-${currentId}`}
                src={previewUrl(kdriveId, currentId)}
                alt={currentFile?.name ?? ""}
                className={`object-contain absolute inset-0 w-full h-full${previewCached ? "" : " animate-fade-in"}`}
              />
            )}
          </>
        )}
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
