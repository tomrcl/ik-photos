import { Controller, Get, Logger, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { inArray } from 'drizzle-orm';
import { Public } from '../auth/public.decorator';
import { DbService } from '../db/db.service';
import { drive } from '../db/schema';
import { DrivesService } from '../drives/drives.service';
import { IndexationService } from './indexation.service';

@SkipThrottle()
@Controller('indexation')
export class IndexationController {
  private readonly logger = new Logger(IndexationController.name);

  constructor(
    private dbService: DbService,
    private drivesService: DrivesService,
    private indexation: IndexationService,
  ) {}

  @Public()
  @Get('trigger')
  async trigger(@Query('mode') mode?: string) {
    const isFull = mode === 'full';
    const statuses: ('COMPLETE' | 'ERROR' | 'INDEXING')[] = isFull
      ? ['COMPLETE', 'ERROR', 'INDEXING']
      : ['COMPLETE', 'ERROR'];

    const drives = await this.dbService.db.query.drive.findMany({
      where: inArray(drive.indexStatus, statuses),
      with: { account: true },
    });

    this.logger.log(
      `Trigger ${isFull ? 'full' : 'incremental'} indexation for ${drives.length} drive(s)`,
    );

    for (const d of drives) {
      if (isFull) {
        await this.drivesService.resetDrive(d.id);
        await this.drivesService.setIndexing(d.id);
        this.indexation.indexDrive(d.account.id, d.id, d.kdriveId, true);
      } else {
        this.indexation.indexDrive(d.account.id, d.id, d.kdriveId);
      }
    }

    return {
      message: `${isFull ? 'Full' : 'Incremental'} indexation triggered`,
      count: drives.length,
    };
  }
}
