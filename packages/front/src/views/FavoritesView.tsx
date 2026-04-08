import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "../components/Header.tsx";
import { PhotoCard } from "../components/PhotoCard.tsx";
import { Spinner } from "../components/Spinner.tsx";
import { SelectionToolbar } from "../components/SelectionToolbar.tsx";
import { Toast, type ToastData } from "../components/Toast.tsx";
import { usePhotoSelection } from "../hooks/usePhotoSelection.ts";
import { navigate } from "../hooks/useHash.ts";
import { deletePhotos, type Photo } from "../api/files.ts";
import { removeBulkFavorites } from "../api/favorites.ts";
import { useI18n } from "../i18n/useI18n.ts";
import { apiFetch } from "../api/client.ts";

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

export function FavoritesView({ kdriveId }: { kdriveId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const cols = useColumns();
  const [toast, setToast] = useState<ToastData | null>(null);

  const { data: photos, isLoading, isError } = useQuery({
    queryKey: ["favoritePhotos", kdriveId],
    queryFn: async () => {
      const res = await apiFetch(`/drives/${kdriveId}/favorites/photos`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      return json.photos as Photo[];
    },
  });

  const allPhotoIds = useMemo(() => photos?.map((p) => p.id) ?? [], [photos]);
  const {
    selected,
    selectedIds,
    selectionCount,
    selectionActive,
    handleSelect,
    clearSelection,
  } = usePhotoSelection(allPhotoIds);

  const handleDelete = async (photoIds: string[]) => {
    await deletePhotos(kdriveId, photoIds);
    await queryClient.invalidateQueries({ queryKey: ["favoritePhotos", kdriveId] });
    await queryClient.invalidateQueries({ queryKey: ["monthCounts"] });
    await queryClient.invalidateQueries({ queryKey: ["drives"] });
    setToast({ message: t("delete.success", { count: photoIds.length }), type: "success" });
    clearSelection();
  };

  const handleRemoveFavorites = async (photoIds: string[]) => {
    await removeBulkFavorites(kdriveId, photoIds);
    const favs = queryClient.getQueryData<Set<string>>(["favorites", kdriveId]) ?? new Set();
    const next = new Set(favs);
    for (const id of photoIds) next.delete(id);
    queryClient.setQueryData(["favorites", kdriveId], next);
    await queryClient.invalidateQueries({ queryKey: ["favoritePhotos", kdriveId] });
    setToast({ message: t("favorites.removed"), type: "success" });
    clearSelection();
  };

  // Escape to clear selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectionActive) clearSelection();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectionActive, clearSelection]);

  const rows = useMemo(() => {
    if (!photos) return [];
    const result: Photo[][] = [];
    for (let i = 0; i < photos.length; i += cols) {
      result.push(photos.slice(i, i + cols));
    }
    return result;
  }, [photos, cols]);

  return (
    <>
      <Header
        breadcrumbs={[
          { label: t("gallery.breadcrumb.drives"), hash: "drives" },
          { label: t("gallery.breadcrumb.photos"), hash: `drive/${kdriveId}` },
          { label: t("favorites.title"), hash: `drive/${kdriveId}/favorites` },
        ]}
      />
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          {t("favorites.title")}{photos && photos.length > 0 && ` (${photos.length})`}
        </h3>

        {isLoading && <Spinner />}
        {isError && <p className="text-red-500 text-center mt-12">{t("gallery.error")}</p>}

        {!isLoading && photos && photos.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center mt-12">{t("favorites.empty")}</p>
        )}

        {rows.map((row, ri) => (
          <div
            key={ri}
            className="grid gap-1 py-0.5"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {row.map((photo) => (
              <PhotoCard
                key={photo.id}
                kdriveId={kdriveId}
                photoId={photo.id}
                fileName={photo.name}
                mediaType={photo.mediaType}
                onClick={() => navigate(`drive/${kdriveId}/photo/${photo.id}`)}
                isSelected={selected.has(photo.id)}
                selectionActive={selectionActive}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ))}
      </div>

      {selectionActive && (
        <SelectionToolbar
          kdriveId={kdriveId}
          count={selectionCount}
          selectedIds={selectedIds}
          onClear={clearSelection}
          onDelete={handleDelete}
          onFavorite={handleRemoveFavorites}
        />
      )}

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
