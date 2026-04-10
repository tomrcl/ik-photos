import { apiFetch } from "./client.ts";
import type { Photo } from "./files.ts";

export interface TrashResult {
  photos: Photo[];
  cursor: string | null;
}

export async function getTrash(
  kdriveId: number,
  cursor?: string,
  limit = 200,
): Promise<TrashResult> {
  let path = `/drives/${kdriveId}/trash?limit=${limit}`;
  if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load trash: ${res.status}`);
  return res.json();
}

export async function restoreFromTrash(
  kdriveId: number,
  ids: string[],
): Promise<{ restored: number }> {
  const res = await apiFetch(`/drives/${kdriveId}/trash/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`Restore failed: ${res.status}`);
  return res.json();
}

/**
 * Permanently delete the given photos from the Corbeille (hard delete on
 * kDrive + DB). The server rejects empty arrays — there is no "empty all"
 * shortcut by design (avoids accidental nuking via malformed body).
 */
export async function permanentlyDelete(
  kdriveId: number,
  ids: string[],
): Promise<{ deleted: number }> {
  const res = await apiFetch(`/drives/${kdriveId}/trash`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`Permanent delete failed: ${res.status}`);
  return res.json();
}
