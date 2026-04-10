import { apiFetch } from "./client.ts";
import { API_BASE } from "../config.ts";
import { getAccessToken } from "../auth/token-store.ts";

export interface Photo {
  id: string;
  name: string;
  lastModifiedAt: string;
  hasThumbnail: boolean;
  mediaType: "image" | "video";
  // EXIF fields — null until extracted or if photo has no EXIF data
  takenAt?: string | null;
  width?: number | null;
  height?: number | null;
  cameraMake?: string | null;
  cameraModel?: string | null;
  lensModel?: string | null;
  iso?: number | null;
  focalLength?: number | null;
  aperture?: number | null;
  shutterSpeed?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  // Soft-delete marker — null while live, ISO string when in Corbeille
  deletedAt?: string | null;
}

export interface PhotoDetail extends Photo {
  kdriveFileId: number;
  extension: string;
  size: number;
  path: string;
}

export interface PhotosResult {
  photos: Photo[];
  cursor: string | null;
}

export interface YearCount {
  year: number;
  count: number;
}

export interface MonthCount {
  year: number;
  month: number;
  count: number;
}

export async function fetchPhotos(
  kdriveId: number,
  cursor?: string,
  limit = 200,
  beforeDate?: string,
): Promise<PhotosResult> {
  let path = `/drives/${kdriveId}/photos?limit=${limit}`;
  if (cursor) {
    path += `&cursor=${encodeURIComponent(cursor)}`;
  }
  if (beforeDate) {
    path += `&beforeDate=${encodeURIComponent(beforeDate)}`;
  }
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to fetch photos: ${res.status}`);
  return res.json();
}

export async function fetchAllPhotos(kdriveId: number): Promise<Photo[]> {
  const res = await apiFetch(`/drives/${kdriveId}/photos/all`);
  if (!res.ok) throw new Error(`Failed to fetch photos: ${res.status}`);
  const json = await res.json();
  return json.photos;
}

export async function fetchYears(kdriveId: number): Promise<YearCount[]> {
  const res = await apiFetch(`/drives/${kdriveId}/photos/years`);
  if (!res.ok) throw new Error(`Failed to fetch years: ${res.status}`);
  const json = await res.json();
  return json.years;
}

export async function fetchMonths(kdriveId: number): Promise<MonthCount[]> {
  const res = await apiFetch(`/drives/${kdriveId}/photos/months`);
  if (!res.ok) throw new Error(`Failed to fetch months: ${res.status}`);
  const json = await res.json();
  return json.months;
}

export interface GeoPhoto {
  id: string;
  lat: number;
  lng: number;
  takenAt: string | null;
}

export async function fetchGeoPhotos(kdriveId: number): Promise<GeoPhoto[]> {
  const res = await apiFetch(`/drives/${kdriveId}/photos/geo`);
  if (!res.ok) throw new Error(`Failed to fetch geo photos: ${res.status}`);
  const json = await res.json();
  return json.photos as GeoPhoto[];
}

export interface MemoryYear {
  year: number;
  yearsAgo: number;
  photos: Photo[];
}

export interface MemoriesResult {
  years: MemoryYear[];
}

export async function fetchMemories(kdriveId: number): Promise<MemoriesResult> {
  const res = await apiFetch(`/drives/${kdriveId}/photos/memories`);
  if (!res.ok) throw new Error(`Failed to fetch memories: ${res.status}`);
  return res.json();
}

export async function fetchMonthPhotos(
  kdriveId: number,
  year: number,
  month: number,
): Promise<Photo[]> {
  const res = await apiFetch(`/drives/${kdriveId}/photos?year=${year}&month=${month}&limit=5000`);
  if (!res.ok) throw new Error(`Failed to fetch month photos: ${res.status}`);
  const json: PhotosResult = await res.json();
  return json.photos as Photo[];
}

function withToken(url: string): string {
  const token = getAccessToken();
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

export function thumbnailUrl(kdriveId: number, photoId: string): string {
  return withToken(`${API_BASE}/drives/${kdriveId}/photos/${photoId}/thumbnail`);
}

export function streamUrl(kdriveId: number, photoId: string): string {
  return withToken(`${API_BASE}/drives/${kdriveId}/photos/${photoId}/stream`);
}

export function previewUrl(kdriveId: number, photoId: string): string {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return withToken(`${API_BASE}/drives/${kdriveId}/photos/${photoId}/preview?w=${w}&h=${h}`);
}

export async function downloadPhotosZip(kdriveId: number, photoIds: string[]): Promise<void> {
  const res = await apiFetch(`/drives/${kdriveId}/photos/download-zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) throw new Error(`Download ZIP failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `photos-${date}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function rotatePhoto(kdriveId: number, photoId: string): Promise<void> {
  const res = await apiFetch(`/drives/${kdriveId}/photos/${photoId}/rotate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Rotate failed: ${res.status}`);
}

export async function deletePhotos(kdriveId: number, photoIds: string[]): Promise<void> {
  const res = await apiFetch(`/drives/${kdriveId}/photos`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function downloadPhoto(kdriveId: number, photoId: string, fileName?: string): Promise<void> {
  const res = await apiFetch(`/drives/${kdriveId}/photos/${photoId}/download`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName ?? "photo";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
