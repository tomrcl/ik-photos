import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GroupedVirtuoso, type GroupedVirtuosoHandle } from "react-virtuoso";
import { Header } from "../components/Header.tsx";
import { PhotoCard } from "../components/PhotoCard.tsx";
import { Spinner } from "../components/Spinner.tsx";
import { Toast, type ToastData } from "../components/Toast.tsx";
import { useMonthCounts } from "../hooks/useMonthCounts.ts";
import { useMonthPhotos } from "../hooks/useMonthPhotos.ts";
import { type Photo, deletePhotos } from "../api/files.ts";
import { startIndexation, getDriveStatus } from "../api/drives.ts";
import { navigate } from "../hooks/useHash.ts";
import { usePhotoSelection } from "../hooks/usePhotoSelection.ts";
import { SelectionToolbar } from "../components/SelectionToolbar.tsx";
import { ReindexModal } from "../components/ReindexModal.tsx";
import { useI18n } from "../i18n/useI18n.ts";
import { bcp47 } from "../i18n/translations/index.ts";

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

  const { data: monthCounts, isLoading, isError } = useMonthCounts(kdriveId);
  const { loadMonth, getMonthPhotos, reset: resetMonthPhotos } = useMonthPhotos(kdriveId);

  const [visibleYear, setVisibleYear] = useState<number | null>(initialPos?.year ?? null);
  const [visibleMonth, setVisibleMonth] = useState<number | null>(initialPos?.month ?? null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [polling, setPolling] = useState(false);
  const [showReindexModal, setShowReindexModal] = useState(false);

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
    for (let i = Math.max(0, visIdx - 1); i <= Math.min(groups.length - 1, visIdx + 1); i++) {
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
  } = usePhotoSelection(allPhotoIds);

  const handleDelete = async (photoIds: string[]) => {
    await deletePhotos(kdriveId, photoIds);
    await queryClient.invalidateQueries({ queryKey: ["monthCounts"] });
    resetMonthPhotos();
    await queryClient.invalidateQueries({ queryKey: ["drives"] });
    setToast({ message: t("delete.success", { count: photoIds.length }), type: "success" });
    clearSelection();
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
            label: reindex.isLoading || polling ? t("drives.indexing") : t("gallery.reindex"),
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>,
            onClick: () => setShowReindexModal(true),
            disabled: reindex.isLoading || polling,
          },
        ]}
      />
      <div className="p-4 pr-10">
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

        {isLoading && <Spinner />}

        {isError && (
          <p className="text-red-500 text-center mt-12">
            {t("gallery.error")}
          </p>
        )}

        {!isLoading && groups.length > 0 && (
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
    </>
  );
}
