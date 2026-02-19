import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, count, min, max, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { account, drive, photo } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { KdriveService } from '../kdrive/kdrive.service';
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

      let cursor: string | undefined;
      let newPhotos = 0;
      let unchangedInBatch = 0;

      // API returns newest photos first (order_by=last_modified_at desc)
      // On re-index: stop when we hit a full batch of already-known unchanged photos
      while (true) {
        await this.rateLimiter.acquire(accountId);
        const result = await this.kdrive.searchPhotos(token, kdriveId, cursor, 1000);

        if (result.files.length === 0) break;

        unchangedInBatch = 0;

        for (const file of result.files) {
          const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
          const lastModified = new Date(file.last_modified_at * 1000);
          const filePath = file.path ?? '';
          const hasThumbnail = file.has_thumbnail ?? true;
          const mediaType = file.extension_type === 'video' ? 'video' : 'image';

          // Check if photo already exists with same date
          if (isReindex) {
            const [existing] = await this.dbService.db
              .select({ lastModifiedAt: photo.lastModifiedAt })
              .from(photo)
              .where(and(eq(photo.driveId, driveId), eq(photo.kdriveFileId, file.id)))
              .limit(1);

            if (existing && existing.lastModifiedAt.getTime() === lastModified.getTime()) {
              unchangedInBatch++;
              continue; // skip — already up to date
            }
          }

          await this.dbService.db
            .insert(photo)
            .values({
              driveId,
              kdriveFileId: file.id,
              name: file.name,
              extension: ext,
              size: BigInt(file.size),
              path: filePath,
              lastModifiedAt: lastModified,
              hasThumbnail,
              mediaType,
            })
            .onConflictDoUpdate({
              target: [photo.driveId, photo.kdriveFileId],
              set: {
                name: file.name,
                size: BigInt(file.size),
                path: filePath,
                lastModifiedAt: lastModified,
                hasThumbnail,
                mediaType,
              },
            });

          newPhotos++;
        }

        // Update progress in DB so the front can poll it
        await this.dbService.db
          .update(drive)
          .set({ totalPhotos: newPhotos })
          .where(eq(drive.id, driveId));

        this.logger.log(
          `Drive ${kdriveId}: batch ${result.files.length} files — ${newPhotos} new/updated, ${unchangedInBatch} unchanged`,
        );

        // On re-index: if entire batch was unchanged, we've caught up
        if (isReindex && unchangedInBatch === result.files.length) {
          this.logger.log(`Drive ${kdriveId}: caught up, stopping incremental indexation`);
          break;
        }

        if (!result.cursor) break;
        cursor = result.cursor;
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
