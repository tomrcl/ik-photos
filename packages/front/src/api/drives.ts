import { apiFetch } from "./client.ts";

export class TokenExpiredError extends Error {
  constructor() {
    super("Infomaniak token expired");
    this.name = "TokenExpiredError";
  }
}

export interface Drive {
  id: string;
  kdriveId: number;
  name: string;
  color: string;
  indexStatus: "PENDING" | "INDEXING" | "COMPLETE" | "ERROR";
  lastIndexedAt: string | null;
  totalPhotos: number;
}

export async function syncDrives(): Promise<Drive[]> {
  const res = await apiFetch("/drives?sync=true");
  if (!res.ok) {
    if (res.status === 403) throw new TokenExpiredError();
    throw new Error(`Failed to list drives: ${res.status}`);
  }
  const json = await res.json();
  return json.drives;
}

export async function listDrives(): Promise<Drive[]> {
  const res = await apiFetch("/drives");
  if (!res.ok) throw new Error(`Failed to list drives: ${res.status}`);
  const json = await res.json();
  return json.drives;
}

export async function startIndexation(kdriveId: number, force = false): Promise<void> {
  const url = `/drives/${kdriveId}/index${force ? "?force=true" : ""}`;
  const res = await apiFetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to start indexation: ${res.status}`);
}

export async function getDriveStatus(kdriveId: number) {
  const res = await apiFetch(`/drives/${kdriveId}/status`);
  if (!res.ok) throw new Error(`Failed to get drive status: ${res.status}`);
  return res.json();
}
