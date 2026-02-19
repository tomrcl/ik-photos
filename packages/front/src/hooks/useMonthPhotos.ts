import { useCallback, useSyncExternalStore } from "react";
import { fetchMonthPhotos, type Photo } from "../api/files.ts";

interface MonthPhotosStore {
  photos: Map<string, Photo[]>;
  loading: Set<string>;
  version: number;
  listeners: Set<() => void>;
}

const stores = new Map<number, MonthPhotosStore>();

function getStore(kdriveId: number): MonthPhotosStore {
  let store = stores.get(kdriveId);
  if (!store) {
    store = { photos: new Map(), loading: new Set(), version: 0, listeners: new Set() };
    stores.set(kdriveId, store);
  }
  return store;
}

function notify(store: MonthPhotosStore) {
  store.version++;
  for (const cb of store.listeners) cb();
}

export function useMonthPhotos(kdriveId: number) {
  const store = getStore(kdriveId);

  // Subscribe to store changes — re-renders when version changes
  const version = useSyncExternalStore(
    useCallback(
      (cb: () => void) => {
        store.listeners.add(cb);
        return () => { store.listeners.delete(cb); };
      },
      [store],
    ),
    useCallback(() => store.version, [store]),
  );

  const loadMonth = useCallback(
    (year: number, month: number) => {
      const key = `${year}-${month}`;
      if (store.loading.has(key)) return;
      store.loading.add(key);
      fetchMonthPhotos(kdriveId, year, month)
        .then((data) => {
          store.photos.set(key, data);
          notify(store);
        })
        .catch(() => {
          store.loading.delete(key);
        });
    },
    [kdriveId, store],
  );

  const getMonthPhotos = useCallback(
    (year: number, month: number): Photo[] | undefined => {
      return store.photos.get(`${year}-${month}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, version],
  );

  const reset = useCallback(() => {
    store.photos.clear();
    store.loading.clear();
    notify(store);
  }, [store]);

  return { loadMonth, getMonthPhotos, reset };
}
