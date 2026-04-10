import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import exifr from 'exifr';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { account, drive, photo } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { KdriveService } from '../kdrive/kdrive.service';
import { RateLimiter } from '../indexation/rate-limiter';

const BATCH_SIZE = 50;
const RANGE_BYTES = 128 * 1024; // 128KB — EXIF lives in the header
// When kDrive ignores the Range header and serves the whole file, cap what we
// will actually parse. Above this threshold we skip parsing to avoid burning
// bandwidth on large RAW/HEIC files (×BATCH_SIZE per batch).
const MAX_FULL_DOWNLOAD_BYTES = 1024 * 1024; // 1 MB

interface ExifUpdate {
  takenAt: Date | null;
  width: number | null;
  height: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  iso: number | null;
  focalLength: number | null;
  aperture: number | null;
  shutterSpeed: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
}

function formatShutterSpeed(exposureTime: number | undefined): string | null {
  if (exposureTime == null || !Number.isFinite(exposureTime) || exposureTime <= 0) return null;
  if (exposureTime < 1) {
    const denom = Math.round(1 / exposureTime);
    return `1/${denom}`;
  }
  // For >= 1s, show as "Xs" (trim trailing zero)
  const rounded = Math.round(exposureTime * 10) / 10;
  return `${rounded}s`;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toFloat(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  const d = new Date(v as string);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Guard against the "Null Island" GPS fix. exifr will happily return
 * { latitude: 0, longitude: 0 } when a camera writes a GPSInfo IFD but
 * never got a real fix. Treat coordinates as valid only when both are
 * finite, within the legal ranges, and not both exactly zero.
 */
function isValidGps(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

@Injectable()
export class ExifService {
  private readonly logger = new Logger(ExifService.name);
  private running = false;

  constructor(
    private dbService: DbService,
    private crypto: CryptoService,
    private kdrive: KdriveService,
    private rateLimiter: RateLimiter,
  ) {}

  // Process one batch every 30 minutes in the background
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledBatch(): Promise<void> {
    try {
      await this.processBatch();
    } catch (err: any) {
      this.logger.error(`Scheduled EXIF batch failed: ${err.message}`);
    }
  }

  /**
   * Process one batch of photos missing exif data.
   * Returns the number of photos processed.
   */
  async processBatch(): Promise<number> {
    if (this.running) {
      this.logger.warn('EXIF batch already running, skipping');
      return 0;
    }
    this.running = true;

    try {
      const rows = await this.dbService.db
        .select({
          id: photo.id,
          driveId: photo.driveId,
          kdriveFileId: photo.kdriveFileId,
          name: photo.name,
          mediaType: photo.mediaType,
          kdriveId: drive.kdriveId,
          accountId: drive.accountId,
          infomaniakToken: account.infomaniakToken,
        })
        .from(photo)
        .innerJoin(drive, eq(photo.driveId, drive.id))
        .innerJoin(account, eq(drive.accountId, account.id))
        .where(and(isNull(photo.exifExtractedAt), isNull(photo.deletedAt)))
        .limit(BATCH_SIZE);

      if (rows.length === 0) return 0;

      this.logger.log(`Processing EXIF for ${rows.length} photo(s)`);

      // Cache decrypted tokens per account to avoid redundant decryption
      const tokenCache = new Map<string, string>();
      const getToken = (accountId: string, encrypted: string): string => {
        let t = tokenCache.get(accountId);
        if (!t) {
          t = this.crypto.decrypt(encrypted);
          tokenCache.set(accountId, t);
        }
        return t;
      };

      let success = 0;
      let noExif = 0;
      let failed = 0;
      let warnedFullDownloadSkip = false;

      for (const row of rows) {
        // Skip videos — just mark as processed
        if (row.mediaType !== 'image') {
          await this.dbService.db
            .update(photo)
            .set({ exifExtractedAt: new Date() })
            .where(eq(photo.id, row.id));
          continue;
        }

        try {
          const token = getToken(row.accountId, row.infomaniakToken);
          await this.rateLimiter.acquire(row.accountId);

          let buffer: Buffer;
          let partial: boolean;
          try {
            const fetched = await this.kdrive.fetchRange(
              token,
              row.kdriveId,
              row.kdriveFileId,
              RANGE_BYTES,
            );
            buffer = fetched.buffer;
            partial = fetched.partial;
          } catch (err: any) {
            this.logger.warn(
              `Range fetch failed for photo ${row.id} (${row.name}): ${err.message}`,
            );
            // Mark as processed to avoid looping
            await this.dbService.db
              .update(photo)
              .set({ exifExtractedAt: new Date() })
              .where(eq(photo.id, row.id));
            failed++;
            continue;
          }

          // Guard against kDrive ignoring the Range header. When that happens
          // and the file is large, skip parsing to avoid a bandwidth bomb
          // (×BATCH_SIZE per batch). Small files are still fine to parse.
          if (!partial && buffer.length > MAX_FULL_DOWNLOAD_BYTES) {
            if (!warnedFullDownloadSkip) {
              this.logger.warn(
                `Range request not honored by kDrive — skipping EXIF parse for oversized full downloads (> ${MAX_FULL_DOWNLOAD_BYTES} bytes) in this batch`,
              );
              warnedFullDownloadSkip = true;
            }
            await this.dbService.db
              .update(photo)
              .set({ exifExtractedAt: new Date() })
              .where(eq(photo.id, row.id));
            noExif++;
            continue;
          }

          const update = await this.parseExif(buffer);

          await this.dbService.db
            .update(photo)
            .set({ ...update, exifExtractedAt: new Date() })
            .where(eq(photo.id, row.id));

          if (update.takenAt || update.cameraMake || update.width) {
            success++;
          } else {
            noExif++;
          }
        } catch (err: any) {
          this.logger.warn(
            `EXIF processing error for photo ${row.id} (${row.name}): ${err.message}`,
          );
          // Mark as processed regardless to prevent infinite loops
          await this.dbService.db
            .update(photo)
            .set({ exifExtractedAt: new Date() })
            .where(eq(photo.id, row.id))
            .catch(() => {});
          failed++;
        }
      }

      // After updating takenAt, refresh drive min/max photo dates
      const touchedDriveIds = [...new Set(rows.map((r) => r.driveId))];
      for (const driveId of touchedDriveIds) {
        await this.refreshDriveDateRange(driveId);
      }

      this.logger.log(
        `EXIF batch done — ${success} with exif, ${noExif} no exif, ${failed} failed`,
      );
      return rows.length;
    } finally {
      this.running = false;
    }
  }

  private async parseExif(buffer: Buffer): Promise<ExifUpdate> {
    const empty: ExifUpdate = {
      takenAt: null,
      width: null,
      height: null,
      cameraMake: null,
      cameraModel: null,
      lensModel: null,
      iso: null,
      focalLength: null,
      aperture: null,
      shutterSpeed: null,
      gpsLat: null,
      gpsLng: null,
    };

    let data: any;
    try {
      data = await exifr.parse(buffer, {
        tiff: true,
        ifd0: true,
        exif: true,
        gps: true,
      } as any);
    } catch (err: any) {
      this.logger.debug?.(`exifr parse failed: ${err.message}`);
      return empty;
    }

    if (!data) return empty;

    const rawLat = toFloat(data.latitude);
    const rawLng = toFloat(data.longitude);
    const gpsValid = isValidGps(rawLat, rawLng);

    return {
      takenAt: toDate(data.DateTimeOriginal ?? data.CreateDate ?? data.ModifyDate),
      width: toInt(data.ExifImageWidth ?? data.ImageWidth),
      height: toInt(data.ExifImageHeight ?? data.ImageHeight),
      cameraMake: toStr(data.Make),
      cameraModel: toStr(data.Model),
      lensModel: toStr(data.LensModel ?? data.Lens),
      iso: toInt(data.ISO ?? data.ISOSpeedRatings),
      focalLength: toFloat(data.FocalLength),
      aperture: toFloat(data.FNumber ?? data.ApertureValue),
      shutterSpeed: formatShutterSpeed(toFloat(data.ExposureTime) ?? undefined),
      gpsLat: gpsValid ? rawLat : null,
      gpsLng: gpsValid ? rawLng : null,
    };
  }

  private async refreshDriveDateRange(driveId: string): Promise<void> {
    await this.dbService.db.execute(sql`
      UPDATE "Drive"
      SET "minPhotoDate" = sub.min_date,
          "maxPhotoDate" = sub.max_date
      FROM (
        SELECT
          MIN("sortDate") AS min_date,
          MAX("sortDate") AS max_date
        FROM "Photo"
        WHERE "driveId" = ${driveId} AND "deletedAt" IS NULL
      ) sub
      WHERE "Drive"."id" = ${driveId}
    `);
  }
}
