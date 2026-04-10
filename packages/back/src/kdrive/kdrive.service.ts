import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { RateLimiter } from '../indexation/rate-limiter';

export interface KDriveFileRaw {
  id: number;
  name: string;
  type: 'file' | 'dir';
  extension_type: string;
  last_modified_at: number;
  size: number;
  has_thumbnail: boolean;
  path: string;
}

export interface SearchPhotosResult {
  files: KDriveFileRaw[];
  cursor: string | null;
}

interface KDriveDriveRaw {
  id: number;
  drive_id: number;
  name: string;
  preferences: { color: string };
}

export interface KDriveDrive {
  id: number;
  name: string;
  color: string;
}

@Injectable()
export class KdriveService {
  private readonly logger = new Logger(KdriveService.name);
  private readonly apiBase: string;

  constructor(
    private config: ConfigService,
    private rateLimiter: RateLimiter,
  ) {
    this.apiBase = this.config.get<string>('KDRIVE_API_BASE', 'https://api.kdrive.infomaniak.com');
  }

  private async apiFetch(url: string, token: string, timeoutMs = 30_000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`kDrive API error: ${res.status} ${url} - ${body}`);
        if (res.status === 401) {
          throw new ForbiddenException('Infomaniak token is invalid or expired');
        }
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async listDrives(token: string): Promise<KDriveDrive[]> {
    const url = `${this.apiBase}/2/drive/users/current/drives?roles[]=admin&roles[]=user`;
    const res = await this.apiFetch(url, token);
    if (!res.ok) throw new Error(`Failed to list drives: ${res.status}`);
    const json: any = await res.json();
    const drives: any[] = json.data;
    this.logger.log(`Found ${drives.length} drive(s)`);
    return drives.map((d) => ({
      id: d.drive_id ?? d.id,
      name: d.drive_name ?? d.name ?? `Drive ${d.drive_id ?? d.id}`,
      color: d.preference?.color ?? d.preferences?.color ?? '#0098FF',
    }));
  }

  async searchPhotos(
    token: string,
    driveId: number,
    cursor?: string,
    limit = 1000,
  ): Promise<SearchPhotosResult> {
    let url = `${this.apiBase}/3/drive/${driveId}/files/search?types[]=image&types[]=video&depth=unlimited&order_by=last_modified_at&order=desc&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    const res = await this.apiFetch(url, token);
    if (!res.ok) throw new Error(`Failed to search photos: ${res.status}`);
    const json: any = await res.json();
    return {
      files: json.data ?? [],
      cursor: json.cursor ?? null,
    };
  }

  async getFileInfo(token: string, driveId: number, fileId: number): Promise<KDriveFileRaw> {
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}?with=capabilities`;
    const res = await this.apiFetch(url, token);
    if (!res.ok) throw new Error(`Failed to get file info: ${res.status}`);
    const json: any = await res.json();
    return json.data;
  }

  async fetchThumbnail(token: string, driveId: number, fileId: number, size = 256): Promise<Buffer> {
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}/thumbnail?width=${size}&height=${size}`;
    const res = await this.apiFetch(url, token);
    if (!res.ok) throw new Error(`Failed to fetch thumbnail: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async fetchPreview(token: string, driveId: number, fileId: number, width = 2048, height = 2048, quality = 80): Promise<{ buffer: Buffer; contentType: string }> {
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}/preview?width=${width}&height=${height}&quality=${quality}`;
    const res = await this.apiFetch(url, token);
    if (!res.ok) throw new Error(`Failed to fetch preview: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get('content-type') || 'image/jpeg',
    };
  }

  async fetchDownloadStream(token: string, driveId: number, fileId: number): Promise<{ stream: Readable; filename: string }> {
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}/download`;
    const res = await this.apiFetch(url, token, 120_000);
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    return {
      stream: Readable.fromWeb(res.body as any),
      filename: match?.[1] || 'download',
    };
  }

  async deleteFile(accountId: string, token: string, driveId: number, fileId: number): Promise<void> {
    // Rate-limit kDrive deletes per account, matching the pattern used by
    // every other kdrive call site. The bulk-delete and trash-purge paths
    // can fan out hundreds of these in quick succession.
    await this.rateLimiter.acquire(accountId);
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Failed to delete file ${fileId}: ${res.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Try a Range request to fetch only the first N bytes of a file.
   * Returns { buffer, partial } — partial=true if the server honored the Range request.
   * Falls back to fetching the full file if Range is not supported.
   */
  async fetchRange(
    token: string,
    driveId: number,
    fileId: number,
    bytes: number,
  ): Promise<{ buffer: Buffer; partial: boolean }> {
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}/download`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Range: `bytes=0-${bytes - 1}`,
        },
        signal: controller.signal,
      });
      if (!res.ok && res.status !== 206) {
        const body = await res.text();
        this.logger.warn(`kDrive range fetch error: ${res.status} ${url} - ${body}`);
        if (res.status === 401) {
          throw new ForbiddenException('Infomaniak token is invalid or expired');
        }
        throw new Error(`Failed to fetch range: ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        partial: res.status === 206,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchDownload(token: string, driveId: number, fileId: number): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}/download`;
    const res = await this.apiFetch(url, token, 120_000);
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
      filename: match?.[1] || 'download',
    };
  }

  async uploadFile(token: string, driveId: number, fileId: number, buffer: Buffer, contentType: string, lastModifiedAt?: number): Promise<void> {
    let url = `${this.apiBase}/3/drive/${driveId}/upload?file_id=${fileId}&total_size=${buffer.length}`;
    if (lastModifiedAt) {
      url += `&last_modified_at=${lastModifiedAt}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: buffer,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`kDrive upload error: ${res.status} - ${body}`);
        throw new Error(`Failed to upload file ${fileId}: ${res.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
