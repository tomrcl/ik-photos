import { useState, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "../components/Header.tsx";
import { PhotoCard } from "../components/PhotoCard.tsx";
import { Spinner } from "../components/Spinner.tsx";
import { ConfirmModal } from "../components/ConfirmModal.tsx";
import { Toast, type ToastData } from "../components/Toast.tsx";
import { usePhotoSelection } from "../hooks/usePhotoSelection.ts";
import { type Photo } from "../api/files.ts";
import { getTrash, restoreFromTrash, permanentlyDelete } from "../api/trash.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { purgePhotosCache } from "../utils/swCache.ts";

function getColumns(): number {
  const w = window.innerWidth;
  if (w >= 1280) return 8;
  if (w >= 1024) return 6;
  if (w >= 768) return 5;
  if (w >= 640) return 4;
  return 3;
}

function useColumns(): number {
  const [cols, setCols] = useState(getColumns);
  useEffect(() => {
    const handler = () => setCols(getColumns());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return cols;
}

const RETENTION_DAYS = 30;

function daysUntilPurge(deletedAt: string | null | undefined): number | null {
  if (!deletedAt) return null;
  const ts = new Date(deletedAt).getTime();
  if (!Number.isFinite(ts)) return null;
  const elapsedMs = Date.now() - ts;
  const remainMs = RETENTION_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(remainMs / (24 * 60 * 60 * 1000)));
}

export function TrashView({ kdriveId }: { kdriveId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const cols = useColumns();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [showPermDelete, setShowPermDelete] = useState(false);
  const [pendingOp, setPendingOp] = useState(false);

  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["trashPhotos", kdriveId],
    queryFn: ({ pageParam }) => getTrash(kdriveId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
  });

  const photos = useMemo(
    () => data?.pages.flatMap((p) => p.photos) ?? [],
    [data],
  );

  const allPhotoIds = useMemo(() => photos.map((p) => p.id), [photos]);
  const {
    selected,
    selectedIds,
    selectionCount,
    selectionActive,
    handleSelect,
    clearSelection,
  } = usePhotoSelection(allPhotoIds);

  const handleRestore = async () => {
    if (selectedIds.length === 0) return;
    setPendingOp(true);
    try {
      await restoreFromTrash(kdriveId, selectedIds);
      // File may have changed on kDrive while in the trash — drop the stale
      // thumbnail/preview for each restored photo so the next fetch is fresh.
      await purgePhotosCache(kdriveId, selectedIds);
      await queryClient.invalidateQueries({ queryKey: ["trashPhotos", kdriveId] });
      await queryClient.invalidateQueries({ queryKey: ["monthCounts"] });
      await queryClient.invalidateQueries({ queryKey: ["drives"] });
      await queryClient.invalidateQueries({ queryKey: ["favoritePhotos", kdriveId] });
      await queryClient.invalidateQueries({ queryKey: ["favorites", kdriveId] });
      await queryClient.invalidateQueries({ queryKey: ["memories", kdriveId] });
      setToast({ message: t("trash.restored", { count: selectedIds.length }), type: "success" });
      clearSelection();
    } catch (e) {
      console.error("Restore failed", e);
      setToast({ message: t("trash.restoreError"), type: "error" });
    } finally {
      setPendingOp(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    setPendingOp(true);
    try {
      await permanentlyDelete(kdriveId, selectedIds);
      await purgePhotosCache(kdriveId, selectedIds);
      await queryClient.invalidateQueries({ queryKey: ["trashPhotos", kdriveId] });
      await queryClient.invalidateQueries({ queryKey: ["favoritePhotos", kdriveId] });
      await queryClient.invalidateQueries({ queryKey: ["favorites", kdriveId] });
      await queryClient.invalidateQueries({ queryKey: ["memories", kdriveId] });
      setShowPermDelete(false);
      setToast({ message: t("trash.permDeleted", { count: selectedIds.length }), type: "success" });
      clearSelection();
    } catch (e) {
      console.error("Permanent delete failed", e);
      setToast({ message: t("trash.permDeleteError"), type: "error" });
    } finally {
      setPendingOp(false);
    }
  };

  // Escape clears selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectionActive) clearSelection();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectionActive, clearSelection]);

  const rows = useMemo(() => {
    const result: Photo[][] = [];
    for (let i = 0; i < photos.length; i += cols) {
      result.push(photos.slice(i, i + cols));
    }
    return result;
  }, [photos, cols]);

  // Infinite-scroll sentinel: when the bottom of the list enters the viewport,
  // fetch the next page. Mirrors the cursor-driven pagination used by the
  // photos list on the backend (same `{photos, cursor}` response shape).
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <Header
        breadcrumbs={[
          { label: t("gallery.breadcrumb.drives"), hash: "drives" },
          { label: t("gallery.breadcrumb.photos"), hash: `drive/${kdriveId}` },
          { label: t("trash.title"), hash: `drive/${kdriveId}/trash` },
        ]}
      />
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          {t("trash.title")}{photos && photos.length > 0 && ` (${photos.length})`}
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          {t("trash.retentionHint")}
        </p>

        {isPending && <Spinner />}
        {isError && <p className="text-red-500 text-center mt-12">{t("gallery.error")}</p>}

        {!isPending && photos && photos.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center mt-12">{t("trash.empty")}</p>
        )}

        {rows.map((row, ri) => (
          <div
            key={ri}
            className="grid gap-1 py-0.5"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {row.map((photo) => {
              const days = daysUntilPurge(photo.deletedAt);
              const title =
                days != null ? t("trash.daysUntilPurge", { count: days }) : photo.name;
              return (
                <div key={photo.id} title={title}>
                  <PhotoCard
                    kdriveId={kdriveId}
                    photoId={photo.id}
                    fileName={photo.name}
                    mediaType={photo.mediaType}
                    // In the trash, clicking toggles selection (no lightbox — photos are trashed)
                    onClick={() => handleSelect(photo.id, false)}
                    isSelected={selected.has(photo.id)}
                    selectionActive
                    onSelect={handleSelect}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {selectionActive && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-lg">
          <div className="flex items-center justify-between px-2 sm:px-4 py-3 max-w-screen-xl mx-auto gap-2">
            <button
              onClick={clearSelection}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer shrink-0"
            >
              {t("selection.cancel")}
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
              {selectionCount}
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleRestore}
                disabled={pendingOp}
                className="flex items-center justify-center bg-green-600 text-white text-sm font-medium p-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                title={t("trash.restore")}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                <span className="hidden sm:inline ml-2">{t("trash.restore")}</span>
              </button>
              <button
                onClick={() => setShowPermDelete(true)}
                disabled={pendingOp}
                className="flex items-center justify-center bg-red-600 text-white text-sm font-medium p-2 sm:px-4 sm:py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                title={t("trash.permanentDelete")}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <span className="hidden sm:inline ml-2">{t("trash.permanentDelete")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showPermDelete && (
        <ConfirmModal
          message={t("trash.confirmPermanent", { count: selectionCount })}
          confirmLabel={t("trash.permanentDelete")}
          onConfirm={handlePermanentDelete}
          onCancel={() => setShowPermDelete(false)}
          loading={pendingOp}
        />
      )}

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
