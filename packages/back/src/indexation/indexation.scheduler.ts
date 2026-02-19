import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { inArray } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { drive } from '../db/schema';
import { IndexationService } from './indexation.service';

@Injectable()
export class IndexationScheduler {
  private readonly logger = new Logger(IndexationScheduler.name);

  constructor(
    private dbService: DbService,
    private indexation: IndexationService,
    private config: ConfigService,
  ) {}

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
