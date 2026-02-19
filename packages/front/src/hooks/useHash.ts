import { useSyncExternalStore } from "react";

function getHash(): string {
  return window.location.hash.slice(1) || "";
}

function subscribe(cb: () => void): () => void {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, getHash);
}

export function navigate(hash: string): void {
  window.location.hash = `#${hash}`;
}
