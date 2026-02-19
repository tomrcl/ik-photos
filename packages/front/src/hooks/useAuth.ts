import { useSyncExternalStore } from "react";
import { isLoggedIn } from "../auth/token-store.ts";

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function notifyAuthChange(): void {
  for (const cb of listeners) cb();
}

export function useAuth(): boolean {
  return useSyncExternalStore(subscribe, isLoggedIn);
}
