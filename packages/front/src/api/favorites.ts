import { apiFetch } from "./client.ts";

export async function listFavorites(kdriveId: number): Promise<string[]> {
  const res = await apiFetch(`/drives/${kdriveId}/favorites`);
  if (!res.ok) throw new Error(`Failed to list favorites: ${res.status}`);
  const json = await res.json();
  return json.photoIds;
}

export async function toggleFavorite(kdriveId: number, photoId: string): Promise<{ favorited: boolean }> {
  const res = await apiFetch(`/drives/${kdriveId}/favorites/${photoId}/toggle`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to toggle favorite: ${res.status}`);
  return res.json();
}

export async function addBulkFavorites(kdriveId: number, photoIds: string[]): Promise<{ added: number }> {
  const res = await apiFetch(`/drives/${kdriveId}/favorites/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) throw new Error(`Failed to add favorites: ${res.status}`);
  return res.json();
}

export async function removeBulkFavorites(kdriveId: number, photoIds: string[]): Promise<{ removed: number }> {
  const res = await apiFetch(`/drives/${kdriveId}/favorites/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) throw new Error(`Failed to remove favorites: ${res.status}`);
  return res.json();
}
