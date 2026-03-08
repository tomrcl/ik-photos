import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, count, min, max, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { account, drive, photo } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { KdriveService, SearchPhotosResult } from '../kdrive/kdrive.service';
import { RateLimiter } from './rate-limiter';

@Injectable()
export class IndexationService {
  private readonly logger = new Logger(IndexationService.name);
  private runningJobs = new Set<string>();

  constructor(
    private dbService: DbService,
    private crypto: CryptoService,
    private kdrive: KdriveService,
    private rateLimiter: RateLimiter,
  ) {}

  indexDrive(accountId: string, driveId: string, kdriveId: number, force = false): void {
    if (this.runningJobs.has(driveId)) {
      if (!force) {
        this.logger.warn(`Indexation already running for drive ${driveId}`);
        return;
      }
      this.logger.warn(`Force re-indexation for drive ${driveId}`);
    }

    this.runIndexation(accountId, driveId, kdriveId).catch((err) => {
      this.logger.error(`Indexation failed for drive ${driveId}: ${err.message}`);
    });
  }

  private async runIndexation(accountId: string, driveId: string, kdriveId: number): Promise<void> {
    this.runningJobs.add(driveId);

    try {
      const [accountRow] = await this.dbService.db
        .select({ infomaniakToken: account.infomaniakToken })
        .from(account)
        .where(eq(account.id, accountId))
        .limit(1);

      if (!accountRow) throw new NotFoundException('Account not found');
      const token = this.crypto.decrypt(accountRow.infomaniakToken);

      // Check if this is a re-index (drive already has photos in DB)
      const [{ value: photoCount }] = await this.dbService.db
        .select({ value: count() })
        .from(photo)
        .where(eq(photo.driveId, driveId));
      const isReindex = photoCount > 0;

      // Pre-load existing photos into a Map for fast lookup during re-index
      let existingPhotos: Map<number, number> | undefined;
      if (isReindex) {
        const rows = await this.dbService.db
          .select({ kdriveFileId: photo.kdriveFileId, lastModifiedAt: photo.lastModifiedAt })
          .from(photo)
          .where(eq(photo.driveId, driveId));
        existingPhotos = new Map(rows.map((r) => [r.kdriveFileId, r.lastModifiedAt.getTime()]));
        this.logger.log(`Drive ${kdriveId}: pre-loaded ${existingPhotos.size} existing photos for re-index`);
      }

      // Resume from saved cursor if available
      const [driveRow] = await this.dbService.db
        .select({ indexCursor: drive.indexCursor })
        .from(drive)
        .where(eq(drive.id, driveId))
        .limit(1);

      let cursor: string | undefined = driveRow?.indexCursor ?? undefined;
      let currentCursor: string | undefined = cursor;
      let newPhotos = 0;
      if (cursor) {
        newPhotos = photoCount;
        this.logger.log(`Drive ${kdriveId}: resuming from saved cursor (${photoCount} photos already indexed)`);
      }

      // Pipeline: fetch next batch while processing current one
      let pendingFetch: Promise<SearchPhotosResult> | null = null;

      // Kick off first fetch
      await this.rateLimiter.acquire(accountId);
      pendingFetch = this.kdrive.searchPhotos(token, kdriveId, cursor, 1000);

      while (pendingFetch) {
        // Await the pre-fetched batch
        const result: SearchPhotosResult = await pendingFetch;
        pendingFetch = null;

        if (result.files.length === 0) break;

        // Start fetching next batch in parallel with DB processing
        const hasNextPage = !!result.cursor;
        if (hasNextPage) {
          const nextCursor = result.cursor!;
          pendingFetch = this.rateLimiter
            .acquire(accountId)
            .then(() => this.kdrive.searchPhotos(token, kdriveId, nextCursor, 1000));
        }

        // Filter and collect files to upsert
        const toUpsert: {
          driveId: string;
          kdriveFileId: number;
          name: string;
          extension: string;
          size: bigint;
          path: string;
          lastModifiedAt: Date;
          hasThumbnail: boolean;
          mediaType: string;
        }[] = [];

        let unchangedInBatch = 0;

        for (const file of result.files) {
          const lastModified = new Date(file.last_modified_at * 1000);

          // Check if photo already exists with same date (in-memory lookup)
          if (existingPhotos) {
            const existingTs = existingPhotos.get(file.id);
            if (existingTs !== undefined && existingTs === lastModified.getTime()) {
              unchangedInBatch++;
              continue;
            }
          }

          const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
          toUpsert.push({
            driveId,
            kdriveFileId: file.id,
            name: file.name,
            extension: ext,
            size: BigInt(file.size),
            path: file.path ?? '',
            lastModifiedAt: lastModified,
            hasThumbnail: file.has_thumbnail ?? true,
            mediaType: file.extension_type === 'video' ? 'video' : 'image',
          });
        }

        // Save current cursor BEFORE upsert — if crash after this, we replay this batch (idempotent)
        await this.dbService.db
          .update(drive)
          .set({ indexCursor: currentCursor ?? null })
          .where(eq(drive.id, driveId));

        // Bulk upsert in chunks of 500
        if (toUpsert.length > 0) {
          const CHUNK_SIZE = 500;
          for (let i = 0; i < toUpsert.length; i += CHUNK_SIZE) {
            const chunk = toUpsert.slice(i, i + CHUNK_SIZE);
            await this.dbService.db
              .insert(photo)
              .values(chunk)
              .onConflictDoUpdate({
                target: [photo.driveId, photo.kdriveFileId],
                set: {
                  name: sql`excluded."name"`,
                  size: sql`excluded."size"`,
                  path: sql`excluded."path"`,
                  lastModifiedAt: sql`excluded."lastModifiedAt"`,
                  hasThumbnail: sql`excluded."hasThumbnail"`,
                  mediaType: sql`excluded."mediaType"`,
                },
              });
          }

          // Update the in-memory map with newly upserted photos
          if (existingPhotos) {
            for (const row of toUpsert) {
              existingPhotos.set(row.kdriveFileId, row.lastModifiedAt.getTime());
            }
          }
        }
        newPhotos += toUpsert.length;

        // Advance cursor and update progress + cursor in DB
        currentCursor = result.cursor ?? undefined;
        await this.dbService.db
          .update(drive)
          .set({ totalPhotos: newPhotos, indexCursor: currentCursor ?? null })
          .where(eq(drive.id, driveId));

        this.logger.log(
          `Drive ${kdriveId}: batch ${result.files.length} files — ${toUpsert.length} new/updated, ${unchangedInBatch} unchanged`,
        );

        // On re-index: if entire batch was unchanged, we've caught up
        if (isReindex && unchangedInBatch === result.files.length) {
          this.logger.log(`Drive ${kdriveId}: caught up, stopping incremental indexation`);
          break;
        }

        if (!hasNextPage) break;
      }

      // Recount total from DB (accurate even after incremental)
      const [{ value: totalPhotos }] = await this.dbService.db
        .select({ value: count() })
        .from(photo)
        .where(eq(photo.driveId, driveId));

      const [dateRange] = await this.dbService.db
        .select({
          minDate: min(photo.lastModifiedAt),
          maxDate: max(photo.lastModifiedAt),
        })
        .from(photo)
        .where(eq(photo.driveId, driveId));

      await this.dbService.db
        .update(drive)
        .set({
          indexStatus: 'COMPLETE',
          lastIndexedAt: new Date(),
          indexCursor: null,
          totalPhotos,
          minPhotoDate: dateRange.minDate,
          maxPhotoDate: dateRange.maxDate,
        })
        .where(eq(drive.id, driveId));

      this.logger.log(
        `Indexation complete for drive ${kdriveId}: ${newPhotos} new/updated, ${totalPhotos} total`,
      );

    } catch (err: any) {
      this.logger.error(`Indexation error for drive ${driveId}: ${err.message}`);
      await this.dbService.db
        .update(drive)
        .set({ indexStatus: 'ERROR' })
        .where(eq(drive.id, driveId))
        .catch(() => {});
    } finally {
      this.runningJobs.delete(driveId);
    }
  }
}
