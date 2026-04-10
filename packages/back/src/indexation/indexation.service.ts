import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, count, inArray, isNull, lt, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { account, drive, photo } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { KdriveService, SearchPhotosResult } from '../kdrive/kdrive.service';
import { RateLimiter } from './rate-limiter';

// Reconciliation safety threshold: abort if more than this fraction of live
// photos would be soft-deleted in a single cycle. Protects against partial
// kDrive responses or transient search-API misses turning into a mass wipe.
const RECONCILE_MAX_DELETE_RATIO = 0.10;

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

  indexDrive(
    accountId: string,
    driveId: string,
    kdriveId: number,
    force = false,
    forceFullWalk = false,
  ): void {
    if (this.runningJobs.has(driveId)) {
      if (!force) {
        this.logger.warn(`Indexation already running for drive ${driveId}`);
        return;
      }
      this.logger.warn(`Force re-indexation for drive ${driveId}`);
    }

    this.runIndexation(accountId, driveId, kdriveId, forceFullWalk).catch((err) => {
      this.logger.error(`Indexation failed for drive ${driveId}: ${err.message}`);
    });
  }

  private async runIndexation(
    accountId: string,
    driveId: string,
    kdriveId: number,
    forceFullWalk = false,
  ): Promise<void> {
    this.runningJobs.add(driveId);

    try {
      const [accountRow] = await this.dbService.db
        .select({ infomaniakToken: account.infomaniakToken })
        .from(account)
        .where(eq(account.id, accountId))
        .limit(1);

      if (!accountRow) throw new NotFoundException('Account not found');
      const token = this.crypto.decrypt(accountRow.infomaniakToken);

      // Check if this is a re-index (drive already has photos in DB).
      // Live count excludes trashed photos — that's what we expose to the user.
      const [{ value: photoCount }] = await this.dbService.db
        .select({ value: count() })
        .from(photo)
        .where(and(eq(photo.driveId, driveId), isNull(photo.deletedAt)));
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
      } else {
        // Fresh cycle (no saved cursor) — stamp the start time so the
        // end-of-cycle reconciliation can flag photos that aren't seen
        // during this walk. We MUST NOT touch this column on a resume,
        // otherwise photos that were upserted in the prior partial cycle
        // would have lastSeenAt < new cycleStartedAt and get wrongly
        // soft-deleted before the resumed walk reaches them.
        await this.dbService.db
          .update(drive)
          .set({ currentCycleStartedAt: new Date() })
          .where(eq(drive.id, driveId));
      }

      // True when the kDrive walk reached the natural end (cursor === null on
      // the last response). Only then is it safe to run reconciliation, since
      // every still-existing photo will have had its lastSeenAt bumped.
      let cycleNaturallyCompleted = false;

      // Pipeline: fetch next batch while processing current one
      let pendingFetch: Promise<SearchPhotosResult> | null = null;

      // Kick off first fetch
      await this.rateLimiter.acquire(accountId);
      pendingFetch = this.kdrive.searchPhotos(token, kdriveId, cursor, 1000);

      while (pendingFetch) {
        // Await the pre-fetched batch
        const result: SearchPhotosResult = await pendingFetch;
        pendingFetch = null;

        if (result.files.length === 0) {
          // Empty page = walked off the end. Equivalent to a null cursor —
          // safe to reconcile (the previous batch already touched everything).
          cycleNaturallyCompleted = true;
          break;
        }

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
          lastSeenAt: Date;
        }[] = [];

        // We need to bump lastSeenAt on EVERY photo seen this cycle, even the
        // ones whose metadata hasn't changed (so the reconciliation pass can
        // tell "still on kDrive" from "vanished"). Collect them separately so
        // we can do a cheap UPDATE on the unchanged set without re-running
        // the full conflict resolution.
        const seenUnchangedIds: number[] = [];
        const nowForBatch = new Date();

        let unchangedInBatch = 0;

        for (const file of result.files) {
          const lastModified = new Date(file.last_modified_at * 1000);

          // Check if photo already exists with same date (in-memory lookup)
          if (existingPhotos) {
            const existingTs = existingPhotos.get(file.id);
            if (existingTs !== undefined && existingTs === lastModified.getTime()) {
              unchangedInBatch++;
              // Still need to refresh lastSeenAt so reconcile doesn't flag it.
              seenUnchangedIds.push(file.id);
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
            lastSeenAt: nowForBatch,
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
                  lastSeenAt: sql`excluded."lastSeenAt"`,
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

        // Bump lastSeenAt on rows that we recognised as unchanged. Done in
        // chunks to keep the parameter list bounded.
        if (seenUnchangedIds.length > 0) {
          const CHUNK_SIZE = 1000;
          for (let i = 0; i < seenUnchangedIds.length; i += CHUNK_SIZE) {
            const chunk = seenUnchangedIds.slice(i, i + CHUNK_SIZE);
            await this.dbService.db
              .update(photo)
              .set({ lastSeenAt: nowForBatch })
              .where(and(eq(photo.driveId, driveId), inArray(photo.kdriveFileId, chunk)));
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

        // On re-index: if entire batch was unchanged, we've caught up.
        // Note: this is an EARLY stop — we have NOT walked the entire drive
        // so we cannot reconcile (older photos that still exist on kDrive
        // haven't had their lastSeenAt refreshed yet).
        // When forceFullWalk is true (?reconcile=true), we skip this
        // optimisation so the walk completes and reconciliation fires.
        if (isReindex && !forceFullWalk && unchangedInBatch === result.files.length) {
          this.logger.log(`Drive ${kdriveId}: caught up, stopping incremental indexation`);
          break;
        }

        if (!hasNextPage) {
          cycleNaturallyCompleted = true;
          break;
        }
      }

      // Run reconciliation BEFORE setComplete / lastIndexedAt update.
      if (cycleNaturallyCompleted) {
        await this.reconcileDeletedPhotos(driveId, kdriveId);
      }

      // Recount total from DB (accurate even after incremental). Only live photos.
      const [{ value: totalPhotos }] = await this.dbService.db
        .select({ value: count() })
        .from(photo)
        .where(and(eq(photo.driveId, driveId), isNull(photo.deletedAt)));

      const [dateRange] = await this.dbService.db
        .select({
          minDate: sql<Date | null>`MIN(${photo.sortDate})`,
          maxDate: sql<Date | null>`MAX(${photo.sortDate})`,
        })
        .from(photo)
        .where(and(eq(photo.driveId, driveId), isNull(photo.deletedAt)));

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

  /**
   * Reconcile photos that exist locally but no longer exist on kDrive.
   *
   * Algorithm:
   *  1. Read drive.currentCycleStartedAt — set when this cycle began (cursor
   *     was null). If null we abort: it means we never opened a fresh cycle
   *     and reconciliation would be unsafe.
   *  2. Find live photos for the drive whose lastSeenAt is older than the
   *     cycle start. Every photo still on kDrive had its lastSeenAt bumped
   *     by the upsert/unchanged-update path during this cycle, so anything
   *     older was not seen on the kDrive walk = it has been deleted on kDrive.
   *  3. Apply a SAFETY THRESHOLD: if more than RECONCILE_MAX_DELETE_RATIO of
   *     the live photos would be deleted, abort with a warning. This guards
   *     against partial kDrive responses or transient search-API misses
   *     turning into a mass wipe.
   *  4. Hard-delete the missing rows (+ cascade removes Favorite links).
   *     There is no point soft-deleting to the Corbeille because the source
   *     file no longer exists on kDrive — the user cannot restore it.
   *  5. Adjust drive.totalPhotos by -missing and clear currentCycleStartedAt.
   *
   * Only invoked when the kDrive walk reached a natural end (cursor === null
   * on the final response). If the cycle is interrupted mid-walk we leave
   * currentCycleStartedAt set and the next resume will continue bumping
   * lastSeenAt against the SAME cycleStartedAt.
   */
  private async reconcileDeletedPhotos(driveId: string, kdriveId: number): Promise<void> {
    const [driveRow] = await this.dbService.db
      .select({ currentCycleStartedAt: drive.currentCycleStartedAt })
      .from(drive)
      .where(eq(drive.id, driveId))
      .limit(1);

    const cycleStartedAt = driveRow?.currentCycleStartedAt;
    if (!cycleStartedAt) {
      this.logger.warn(
        `[reconcile] drive=${driveId} skipped: currentCycleStartedAt is null`,
      );
      return;
    }

    const missing = await this.dbService.db
      .select({ id: photo.id })
      .from(photo)
      .where(
        and(
          eq(photo.driveId, driveId),
          isNull(photo.deletedAt),
          lt(photo.lastSeenAt, cycleStartedAt),
        ),
      );

    if (missing.length === 0) {
      // Nothing to reconcile — clear the cycle marker and return.
      await this.dbService.db
        .update(drive)
        .set({ currentCycleStartedAt: null })
        .where(eq(drive.id, driveId));
      return;
    }

    // Safety threshold: refuse to soft-delete a huge fraction of the library
    // in one go. The cycle marker is intentionally LEFT in place so the
    // operator can investigate; the next cycle will replace it.
    const [{ value: liveTotal }] = await this.dbService.db
      .select({ value: count() })
      .from(photo)
      .where(and(eq(photo.driveId, driveId), isNull(photo.deletedAt)));

    const ratio = liveTotal === 0 ? 0 : missing.length / liveTotal;
    if (ratio > RECONCILE_MAX_DELETE_RATIO) {
      this.logger.warn(
        `[reconcile] drive=${driveId} kdrive=${kdriveId} ABORTED: would hard-delete ` +
          `${missing.length}/${liveTotal} photos (${(ratio * 100).toFixed(1)}%) — ` +
          `above the ${(RECONCILE_MAX_DELETE_RATIO * 100).toFixed(0)}% safety cap. ` +
          `Investigate kDrive search response before re-running.`,
      );
      return;
    }

    const ids = missing.map((m) => m.id);
    // Hard-delete: the photos no longer exist on kDrive so there is nothing
    // to restore — keeping them in the Corbeille would be misleading.
    // Cascade on the FK also removes associated Favorite rows.
    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await this.dbService.db
        .delete(photo)
        .where(and(eq(photo.driveId, driveId), inArray(photo.id, chunk)));
    }

    // Decrement the cached total (the end-of-cycle recount in runIndexation
    // also self-heals, but keep the incremental counter consistent).
    await this.dbService.db
      .update(drive)
      .set({
        totalPhotos: sql`GREATEST(0, "totalPhotos" - ${missing.length})`,
        currentCycleStartedAt: null,
      })
      .where(eq(drive.id, driveId));

    this.logger.log(
      `[reconcile] drive=${driveId} kdrive=${kdriveId} hard-deleted ${missing.length} photos missing from kDrive`,
    );
  }
}
