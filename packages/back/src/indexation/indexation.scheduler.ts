import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { drive } from '../db/schema';
import { IndexationService } from './indexation.service';

@Injectable()
export class IndexationScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexationScheduler.name);

  constructor(
    private dbService: DbService,
    private indexation: IndexationService,
    private config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const stuckDrives = await this.dbService.db.query.drive.findMany({
      where: eq(drive.indexStatus, 'INDEXING'),
      with: { account: true },
    });

    if (stuckDrives.length === 0) return;

    this.logger.warn(`Found ${stuckDrives.length} drive(s) stuck in INDEXING state, resuming...`);
    for (const d of stuckDrives) {
      this.logger.log(`Resuming indexation for drive ${d.kdriveId} (cursor: ${d.indexCursor ? 'yes' : 'none'})`);
      this.indexation.indexDrive(d.account.id, d.id, d.kdriveId, true);
    }
  }

  // Default: every 6 hours. Override via REINDEX_CRON env var at startup.
  @Cron(CronExpression.EVERY_6_HOURS)
  async reindexAll() {
    this.logger.log('Starting scheduled re-indexation');

    const drives = await this.dbService.db.query.drive.findMany({
      where: inArray(drive.indexStatus, ['COMPLETE', 'ERROR']),
      with: { account: true },
    });

    for (const d of drives) {
      this.logger.log(`Scheduling re-index for drive ${d.kdriveId}`);
      this.indexation.indexDrive(d.account.id, d.id, d.kdriveId);
    }
  }
}
