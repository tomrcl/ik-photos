export interface KDriveFile {
  id: number;
  name: string;
  type: "file" | "dir";
  extension_type: string;
  last_modified_at: number;
  size: number;
  has_thumbnail: boolean;
  path: string;
}

export interface PhotoDto {
  id: string;
  kdriveFileId: number;
  name: string;
  extension: string;
  size: number;
  path: string;
  lastModifiedAt: string;
  hasThumbnail: boolean;
}

export interface DriveDto {
  id: string;
  kdriveId: number;
  name: string;
  color: string;
  indexStatus: "PENDING" | "INDEXING" | "COMPLETE" | "ERROR";
  lastIndexedAt: string | null;
  totalPhotos: number;
  minPhotoDate: string | null;
  maxPhotoDate: string | null;
}

export interface YearCount {
  year: number;
  count: number;
}
