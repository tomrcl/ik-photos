import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { account, drive, photo } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { KdriveService } from '../kdrive/kdrive.service';
import { pMap } from '../common/p-map';

const RETENTION_DAYS = 30;
const KDRIVE_DELETE_CONCURRENCY = 6;

/**
 * Auto-purge Corbeille entries older than 30 days. Hard-deletes from kDrive
 * (best-effort) and then from the DB. Runs daily at 03:00 server time.
 */
@Injectable()
export class TrashScheduler {
  private readonly logger = new Logger(TrashScheduler.name);
  private running = false;

  constructor(
    private dbService: DbService,
    private crypto: CryptoService,
    private kdrive: KdriveService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledPurge(): Promise<void> {
    if (this.running) {
      this.logger.warn('Trash purge already running, skipping');
      return;
    }
    this.running = true;
    try {
      const purged = await this.purgeExpired();
      if (purged > 0) {
        this.logger.log(`Trash auto-purge: ${purged} photo(s) permanently deleted`);
      }
    } catch (err: any) {
      this.logger.error(`Trash auto-purge failed: ${err.message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Hard-delete all photos whose deletedAt is older than 30 days ago.
   * Returns the number of photos purged from the DB (best-effort on kDrive).
   */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Join photo -> drive -> account so we can get the kdrive file id and the
    // encrypted Infomaniak token in a single query.
    const rows = await this.dbService.db
      .select({
        id: photo.id,
        driveId: photo.driveId,
        kdriveFileId: photo.kdriveFileId,
        kdriveId: drive.kdriveId,
        accountId: drive.accountId,
        infomaniakToken: account.infomaniakToken,
      })
      .from(photo)
      .innerJoin(drive, eq(photo.driveId, drive.id))
      .innerJoin(account, eq(drive.accountId, account.id))
      .where(and(isNotNull(photo.deletedAt), lt(photo.deletedAt, cutoff)));

    if (rows.length === 0) return 0;

    // Cache decrypted tokens per account
    const tokenCache = new Map<string, string>();
    const getToken = (accountId: string, encrypted: string): string => {
      let t = tokenCache.get(accountId);
      if (!t) {
        t = this.crypto.decrypt(encrypted);
        tokenCache.set(accountId, t);
      }
      return t;
    };

    // Best-effort kDrive deletes with bounded concurrency. 404 is handled
    // inside kdrive.deleteFile, so fulfilled = "gone on kDrive" (either
    // deleted now or already missing) and we're safe to purge the DB row.
    const settled = await pMap(rows, KDRIVE_DELETE_CONCURRENCY, async (row) => {
      const token = getToken(row.accountId, row.infomaniakToken);
      await this.kdrive.deleteFile(row.accountId, token, row.kdriveId, row.kdriveFileId);
      return { id: row.id, driveId: row.driveId };
    });

    const toPurge: string[] = [];
    settled.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        toPurge.push(res.value.id);
      } else {
        const msg = (res.reason as Error)?.message ?? 'unknown error';
        const row = rows[i];
        this.logger.warn(
          `Trash purge: kDrive delete failed for photo ${row.id} (kdriveFileId=${row.kdriveFileId}): ${msg}`,
        );
      }
    });

    if (toPurge.length > 0) {
      // Delete in chunks to keep parameter count low
      const CHUNK = 500;
      for (let i = 0; i < toPurge.length; i += CHUNK) {
        const chunk = toPurge.slice(i, i + CHUNK);
        await this.dbService.db.execute(
          sql`DELETE FROM "Photo" WHERE "id" = ANY(${chunk}::uuid[])`,
        );
      }
    }

    return toPurge.length;
  }
}
