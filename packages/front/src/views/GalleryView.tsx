import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GroupedVirtuoso, type GroupedVirtuosoHandle } from "react-virtuoso";
import { Header } from "../components/Header.tsx";
import { PhotoCard } from "../components/PhotoCard.tsx";
import { Spinner } from "../components/Spinner.tsx";
import { Toast, type ToastData } from "../components/Toast.tsx";
import { MemoriesStrip } from "../components/MemoriesStrip.tsx";
import { useMonthCounts } from "../hooks/useMonthCounts.ts";
import { useMonthPhotos } from "../hooks/useMonthPhotos.ts";
import { type Photo, deletePhotos } from "../api/files.ts";
import { startIndexation, getDriveStatus } from "../api/drives.ts";
import { listFavorites, addBulkFavorites } from "../api/favorites.ts";
import { navigate } from "../hooks/useHash.ts";
import { usePhotoSelection } from "../hooks/usePhotoSelection.ts";
import { useDragSelect } from "../hooks/useDragSelect.ts";
import { SelectionToolbar } from "../components/SelectionToolbar.tsx";
import { ReindexModal } from "../components/ReindexModal.tsx";
import { useI18n } from "../i18n/useI18n.ts";
import { bcp47 } from "../i18n/translations/index.ts";
import { purgePhotosCache } from "../utils/swCache.ts";

interface MonthGroup {
  label: string;
  year: number;
  month: number;
  count: number;
  photos: Photo[];
  loaded: boolean;
}

function formatMonthLabel(year: number, month: number, bcp47Locale: string): string {
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString(bcp47Locale, { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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

function TimelineScrubber({
  groups,
  visibleYear,
  visibleMonth,
  onClickGroup,
}: {
  groups: MonthGroup[];
  visibleYear: number | null;
  visibleMonth: number | null;
  onClickGroup: (groupIndex: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [mouseY, setMouseY] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(-1);

  const layout = useMemo(() => {
    const total = groups.reduce((s, g) => s + g.count, 0);
    if (total === 0) return [];
    let cum = 0;
    return groups.map((g) => {
      const start = cum / total;
      cum += g.count;
      return { start, end: cum / total, year: g.year, month: g.month, label: g.label };
    });
  }, [groups]);

  const yearMarks = useMemo(() => {
    const all: { year: number; position: number }[] = [];
    for (let i = 0; i < layout.length; i++) {
      if (i === 0 || layout[i].year !== layout[i - 1].year) {
        all.push({ year: layout[i].year, position: layout[i].start });
      }
    }
    if (all.length <= 2) return all;
    const first = all[0];
    const last = all[all.length - 1];
    const minGap = 0.035;
    const marks: typeof all = [first];
    for (let i = 1; i < all.length - 1; i++) {
      const prev = marks[marks.length - 1];
      if (all[i].position - prev.position >= minGap && last.position - all[i].position >= minGap) {
        marks.push(all[i]);
      }
    }
    marks.push(last);
    return marks;
  }, [layout]);

  const currentPosition = useMemo(() => {
    const idx = layout.findIndex((l) => l.year === visibleYear && l.month === visibleMonth);
    if (idx < 0) return 0;
    return (layout[idx].start + layout[idx].end) / 2;
  }, [layout, visibleYear, visibleMonth]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const fraction = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setMouseY(e.clientY);
      const idx = layout.findIndex((l) => fraction <= l.end);
      setHoveredIndex(idx >= 0 ? idx : layout.length - 1);
    },
    [layout],
  );

  const handleClick = useCallback(() => {
    if (hoveredIndex >= 0) onClickGroup(hoveredIndex);
  }, [hoveredIndex, onClickGroup]);

  if (layout.length === 0) return null;

  return (
    <div
      className="fixed right-0 top-12 bottom-0 w-10 z-20 cursor-pointer"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIndex(-1)}
      onClick={handleClick}
    >
      {/* Track: year labels alternating with line segments */}
      <div
        ref={trackRef}
        className="absolute inset-x-0 top-4 bottom-4 flex flex-col items-end pr-1"
      >
        {yearMarks.map((mark, i) => {
          const next = yearMarks[i + 1];
          const segmentFraction = next ? next.position - mark.position : 1 - mark.position;
          const isLast = i === yearMarks.length - 1;
          return (
            <div key={mark.year} className="flex flex-col items-end shrink-0" style={{ height: `${segmentFraction * 100}%` }}>
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 bg-white/90 dark:bg-gray-800/90 rounded px-0.5 leading-tight whitespace-nowrap pointer-events-none">
                {mark.year}
              </span>
              {!isLast && (
                <div className="flex-1 w-0.5 bg-gray-300 dark:bg-gray-600 rounded mr-[11px] mt-0.5 mb-0.5" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current position indicator */}
      <div className="absolute right-1 top-4 bottom-4 pointer-events-none">
        <div
          className="absolute w-3 h-0.5 bg-blue-500 -left-1 transition-[top] duration-200"
          style={{ top: `${currentPosition * 100}%` }}
        />
      </div>

      {/* Tooltip on hover */}
      {hoveredIndex >= 0 && groups[hoveredIndex] && (
        <div
          className="fixed right-12 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none"
          style={{ top: mouseY - 14 }}
        >
          {groups[hoveredIndex].label}
        </div>
      )}
    </div>
  );
}

export function GalleryView({ kdriveId, initialPos }: { kdriveId: number; initialPos?: { year: number; month: number } }) {
  const { t, locale } = useI18n();
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null);
  const queryClient = useQueryClient();
  const cols = useColumns();

  const { data: monthCounts, isPending, isError } = useMonthCounts(kdriveId);
  const { loadMonth, getMonthPhotos, reset: resetMonthPhotos } = useMonthPhotos(kdriveId);

  const [visibleYear, setVisibleYear] = useState<number | null>(initialPos?.year ?? null);
  const [visibleMonth, setVisibleMonth] = useState<number | null>(initialPos?.month ?? null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [polling, setPolling] = useState(false);
  const [showReindexModal, setShowReindexModal] = useState(false);

  // Load favorite IDs for this drive
  useQuery({
    queryKey: ["favorites", kdriveId],
    queryFn: async () => {
      const ids = await listFavorites(kdriveId);
      return new Set(ids);
    },
    staleTime: 60_000,
  });

  // Poll drive status while indexing
  const { data: driveStatus } = useQuery({
    queryKey: ["driveStatus", kdriveId],
    queryFn: () => getDriveStatus(kdriveId),
    refetchInterval: polling ? 2000 : false,
    staleTime: 0,
  });

  // React to status changes while polling
  useEffect(() => {
    if (!polling || !driveStatus) return;
    if (driveStatus.indexStatus === "COMPLETE") {
      setPolling(false);
      setToast({ message: t("gallery.indexComplete", { count: driveStatus.totalPhotos }), type: "success" });
      queryClient.invalidateQueries({ queryKey: ["monthCounts"] });
      resetMonthPhotos();
      queryClient.invalidateQueries({ queryKey: ["drives"] });
    } else if (driveStatus.indexStatus === "ERROR") {
      setPolling(false);
      setToast({ message: t("gallery.indexError"), type: "error" });
    }
  }, [polling, driveStatus, t, queryClient, resetMonthPhotos]);

  const reindex = useMutation({
    mutationFn: (mode: "partial" | "full") => startIndexation(kdriveId, true, mode),
    onSuccess: () => {
      setShowReindexModal(false);
      setToast({ message: t("gallery.indexing"), type: "info" });
      setPolling(true);
    },
    onError: () => {
      setShowReindexModal(false);
      setToast({ message: t("gallery.indexError"), type: "error" });
    },
  });

  const totalPhotos = useMemo(
    () => monthCounts?.reduce((s, mc) => s + mc.count, 0) ?? 0,
    [monthCounts],
  );

  // Build groups from month counts + cached photos
  // rev triggers recomputation when month photos load
  const groups = useMemo((): MonthGroup[] => {
    if (!monthCounts) return [];
    return monthCounts.map((mc) => {
      const photos = getMonthPhotos(mc.year, mc.month) ?? [];
      return {
        label: formatMonthLabel(mc.year, mc.month, bcp47[locale]),
        year: mc.year,
        month: mc.month,
        count: mc.count,
        photos,
        loaded: photos.length > 0,
      };
    });
  }, [monthCounts, getMonthPhotos, locale]);

  // Set initial visible month from first group when counts arrive
  useEffect(() => {
    if (visibleYear != null && visibleMonth != null) return;
    if (!groups.length) return;
    setVisibleYear(groups[0].year);
    setVisibleMonth(groups[0].month);
  }, [groups, visibleYear, visibleMonth]);

  // Load visible month + 2 before/after
  useEffect(() => {
    if (!groups.length || visibleYear == null || visibleMonth == null) return;
    const visIdx = groups.findIndex((g) => g.year === visibleYear && g.month === visibleMonth);
    if (visIdx < 0) return;
    for (let i = Math.max(0, visIdx - 3); i <= Math.min(groups.length - 1, visIdx + 3); i++) {
      loadMonth(groups[i].year, groups[i].month);
    }
  }, [visibleYear, visibleMonth, groups, loadMonth]);

  // Flat list of photo IDs from loaded months (for selection)
  const allPhotoIds = useMemo(() => {
    const ids: string[] = [];
    for (const g of groups) {
      for (const p of g.photos) ids.push(p.id);
    }
    return ids;
  }, [groups]);

  const {
    selected,
    selectedIds,
    selectionCount,
    selectionActive,
    handleSelect,
    clearSelection,
    setSelection,
  } = usePhotoSelection(allPhotoIds);

  const handleDragSelectionChange = useCallback(
    (ids: Set<string>) => setSelection(ids),
    [setSelection],
  );

  const { isDragging, dragRect } = useDragSelect({
    currentSelection: selected,
    onSelectionChange: handleDragSelectionChange,
  });

  const handleDelete = async (photoIds: string[]) => {
    await deletePhotos(kdriveId, photoIds);
    // Purge each deleted photo from the SW runtime cache so a hostile
    // CacheFirst hit can't reveal an already-deleted image.
    await purgePhotosCache(kdriveId, photoIds);
    await queryClient.invalidateQueries({ queryKey: ["monthCounts"] });
    resetMonthPhotos();
    await queryClient.invalidateQueries({ queryKey: ["drives"] });
    await queryClient.invalidateQueries({ queryKey: ["favoritePhotos", kdriveId] });
    await queryClient.invalidateQueries({ queryKey: ["memories", kdriveId] });
    setToast({ message: t("delete.success", { count: photoIds.length }), type: "success" });
    clearSelection();
  };

  const handleBulkFavorite = async (photoIds: string[]) => {
    try {
      await addBulkFavorites(kdriveId, photoIds);
      const favs = queryClient.getQueryData<Set<string>>(["favorites", kdriveId]) ?? new Set();
      const next = new Set(favs);
      for (const id of photoIds) next.add(id);
      queryClient.setQueryData(["favorites", kdriveId], next);
      setToast({ message: t("favorites.bulkAdded", { count: photoIds.length }), type: "success" });
      clearSelection();
    } catch (e) {
      console.error("Bulk favorite failed", e);
    }
  };

  // Escape to clear selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectionActive) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectionActive, clearSelection]);

  // Each item = 1 row of photos. Group count = number of rows in that group.
  const groupCounts = useMemo(
    () => groups.map((g) => Math.ceil(g.count / cols)),
    [groups, cols],
  );

  // Cumulative row offsets: groupRowOffsets[i] = global item index of the first row of group i
  const groupRowOffsets = useMemo(() => {
    const offsets = [0];
    for (let i = 0; i < groupCounts.length; i++) {
      offsets.push(offsets[i] + groupCounts[i]);
    }
    return offsets;
  }, [groupCounts]);

  // Compute initial item index from initialPos
  const initialItemIndex = useMemo(() => {
    if (!initialPos || groups.length === 0) return undefined;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.year === initialPos.year && (initialPos.month === 0 || g.month === initialPos.month)) {
        return groupRowOffsets[i];
      }
    }
    return undefined;
  }, [initialPos, groups, groupRowOffsets]);

  // Update hash with year/month when scrolling
  useEffect(() => {
    if (visibleYear == null || visibleMonth == null) return;
    const newHash = `drive/${kdriveId}/${visibleYear}/${visibleMonth}`;
    if (window.location.hash !== `#${newHash}`) {
      history.replaceState(null, "", `#${newHash}`);
    }
  }, [visibleYear, visibleMonth, kdriveId]);

  const handleRangeChanged = useCallback(
    (range: { startIndex: number }) => {
      for (let i = 0; i < groupRowOffsets.length - 1; i++) {
        if (range.startIndex < groupRowOffsets[i + 1]) {
          setVisibleYear(groups[i].year);
          setVisibleMonth(groups[i].month);
          break;
        }
      }
    },
    [groups, groupRowOffsets],
  );

  const handleClickGroup = useCallback(
    (groupIndex: number) => {
      const g = groups[groupIndex];
      if (!g) return;
      setVisibleYear(g.year);
      setVisibleMonth(g.month);
      virtuosoRef.current?.scrollToIndex({ index: groupRowOffsets[groupIndex], align: "start" });
    },
    [groups, groupRowOffsets],
  );

  return (
    <>
      <Header
        breadcrumbs={[
          { label: t("gallery.breadcrumb.drives"), hash: "drives" },
          { label: t("gallery.breadcrumb.photos"), hash: `drive/${kdriveId}` },
        ]}
        menuItems={[
          {
            label: t("favorites.title"),
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>,
            onClick: () => navigate(`drive/${kdriveId}/favorites`),
          },
          {
            label: t("menu.map"),
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
            onClick: () => navigate(`drive/${kdriveId}/map`),
          },
          {
            label: t("trash.title"),
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>,
            onClick: () => navigate(`drive/${kdriveId}/trash`),
          },
          {
            label: reindex.isPending || polling ? t("drives.indexing") : t("gallery.reindex"),
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>,
            onClick: () => setShowReindexModal(true),
            disabled: reindex.isPending || polling,
          },
        ]}
      />
      <div className="p-4 pr-10" data-drag-select-area>
        <MemoriesStrip kdriveId={kdriveId} />
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t("gallery.photos")}{totalPhotos > 0 && ` (${totalPhotos})`}
          </h3>
          {driveStatus?.lastIndexedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t("gallery.lastIndexed", { date: new Date(driveStatus.lastIndexedAt).toLocaleDateString(bcp47[locale], { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) })}
            </p>
          )}
        </div>

        {isPending && <Spinner />}

        {isError && (
          <p className="text-red-500 text-center mt-12">
            {t("gallery.error")}
          </p>
        )}

        {!isPending && groups.length > 0 && (
          <div className="relative">
            <GroupedVirtuoso
              ref={virtuosoRef}
              useWindowScroll
              groupCounts={groupCounts}
              overscan={800}
              {...(initialItemIndex != null ? { initialTopMostItemIndex: initialItemIndex } : {})}
              rangeChanged={handleRangeChanged}
              groupContent={(index) => (
                <div className="bg-gray-100/95 dark:bg-gray-900/95 backdrop-blur-sm py-2 px-1 sticky top-12 z-[5]">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {groups[index].label}
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-2">
                      ({groups[index].count})
                    </span>
                  </h4>
                </div>
              )}
              itemContent={(index, groupIndex) => {
                const group = groups[groupIndex];
                if (!group) return null;
                const rowInGroup = index - groupRowOffsets[groupIndex];
                const start = rowInGroup * cols;

                if (!group.loaded) {
                  const cellsInRow = Math.min(cols, group.count - start);
                  return (
                    <div
                      className="grid gap-1 py-0.5"
                      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                    >
                      {Array.from({ length: cellsInRow }, (_, i) => (
                        <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      ))}
                    </div>
                  );
                }

                const rowPhotos = group.photos.slice(start, start + cols);
                if (rowPhotos.length === 0) return null;
                return (
                  <div
                    className="grid gap-1 py-0.5"
                    style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                  >
                    {rowPhotos.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        kdriveId={kdriveId}
                        photoId={photo.id}
                        fileName={photo.name}
                        mediaType={photo.mediaType}
                        onClick={() =>
                          navigate(`drive/${kdriveId}/photo/${photo.id}`)
                        }
                        isSelected={selected.has(photo.id)}
                        selectionActive={selectionActive}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                );
              }}
            />

            {groups.length > 1 && (
              <TimelineScrubber
                groups={groups}
                visibleYear={visibleYear}
                visibleMonth={visibleMonth}
                onClickGroup={handleClickGroup}
              />
            )}
          </div>
        )}
      </div>

      {selectionActive && (
        <SelectionToolbar
          kdriveId={kdriveId}
          count={selectionCount}
          selectedIds={selectedIds}
          onClear={clearSelection}
          onDelete={handleDelete}
          onFavorite={handleBulkFavorite}
        />
      )}

      {showReindexModal && (
        <ReindexModal
          onPartial={() => reindex.mutate("partial")}
          onFull={() => reindex.mutate("full")}
          onCancel={() => setShowReindexModal(false)}
        />
      )}

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      {/* Drag-select rectangle overlay */}
      {isDragging && dragRect && (
        <div
          className="fixed border-2 border-blue-500 bg-blue-500/15 rounded-sm pointer-events-none z-50"
          style={{
            left: dragRect.x,
            top: dragRect.y,
            width: dragRect.width,
            height: dragRect.height,
          }}
        />
      )}
    </>
  );
}
