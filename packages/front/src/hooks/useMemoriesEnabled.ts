import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ik-photos:memories-enabled";

function read(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  return read();
}

function notify() {
  for (const cb of listeners) cb();
}

/**
 * Read/write the `memories enabled` flag from localStorage. Reactive: all
 * consumers re-render when the value changes (within the same tab or via a
 * `storage` event from another tab). Defaults to `true`.
 */
export function useMemoriesEnabled(): [boolean, (b: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setEnabled = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
    } catch {
      // ignore quota / privacy-mode failures
    }
    notify();
  }, []);

  return [enabled, setEnabled];
}
