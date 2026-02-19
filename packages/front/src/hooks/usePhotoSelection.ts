import { useState, useCallback, useRef, useMemo } from "react";

export function usePhotoSelection(allPhotoIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastClickedIdRef = useRef<string | null>(null);

  const handleSelect = useCallback(
    (photoId: string, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastClickedIdRef.current) {
          const lastIdx = allPhotoIds.indexOf(lastClickedIdRef.current);
          const curIdx = allPhotoIds.indexOf(photoId);
          if (lastIdx !== -1 && curIdx !== -1) {
            const from = Math.min(lastIdx, curIdx);
            const to = Math.max(lastIdx, curIdx);
            for (let i = from; i <= to; i++) {
              next.add(allPhotoIds[i]);
            }
            return next;
          }
        }

        if (next.has(photoId)) {
          next.delete(photoId);
        } else {
          next.add(photoId);
        }

        return next;
      });

      lastClickedIdRef.current = photoId;
    },
    [allPhotoIds],
  );

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    lastClickedIdRef.current = null;
  }, []);

  const selectionCount = selected.size;
  const selectionActive = selectionCount > 0;

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return {
    selected,
    selectedIds,
    selectionCount,
    selectionActive,
    handleSelect,
    clearSelection,
  };
}
