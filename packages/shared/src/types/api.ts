import type { PhotoDto, DriveDto, YearCount } from "./photo";

export interface RegisterRequest {
  email: string;
  password: string;
  infomaniakToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
}

export interface MeResponse {
  id: string;
  email: string;
}

export interface DrivesListResponse {
  drives: DriveDto[];
}

export interface DriveStatusResponse {
  kdriveId: number;
  indexStatus: "PENDING" | "INDEXING" | "COMPLETE" | "ERROR";
  totalPhotos: number;
  lastIndexedAt: string | null;
  minPhotoDate: string | null;
  maxPhotoDate: string | null;
}

export interface PhotosListResponse {
  photos: PhotoDto[];
  cursor: string | null;
}

export interface YearsResponse {
  years: YearCount[];
}
