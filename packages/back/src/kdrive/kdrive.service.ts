import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

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

  constructor(private config: ConfigService) {
    this.apiBase = this.config.get<string>('KDRIVE_API_BASE', 'https://api.kdrive.infomaniak.com');
  }

  private async apiFetch(url: string, token: string): Promise<Response> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`kDrive API error: ${res.status} ${url} - ${body}`);
    }
    return res;
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
    const res = await this.apiFetch(url, token);
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    return {
      stream: Readable.fromWeb(res.body as any),
      filename: match?.[1] || 'download',
    };
  }

  async deleteFile(token: string, driveId: number, fileId: number): Promise<void> {
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete file ${fileId}: ${res.status}`);
    }
  }

  async fetchDownload(token: string, driveId: number, fileId: number): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const url = `${this.apiBase}/2/drive/${driveId}/files/${fileId}/download`;
    const res = await this.apiFetch(url, token);
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
}
