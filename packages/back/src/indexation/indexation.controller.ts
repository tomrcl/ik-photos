import { BadRequestException, Controller, Get, Logger, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { inArray } from 'drizzle-orm';
import { Public } from '../auth/public.decorator';
import { DbService } from '../db/db.service';
import { drive } from '../db/schema';
import { IndexationService } from './indexation.service';

@SkipThrottle()
@Controller('indexation')
export class IndexationController {
  private readonly logger = new Logger(IndexationController.name);

  constructor(
    private dbService: DbService,
    private indexation: IndexationService,
  ) {}

  @Public()
  @Get('trigger')
  async trigger(
    @Query('mode') mode?: string,
    @Query('reconcile') reconcile?: string,
  ) {
    if (mode === 'full') {
      throw new BadRequestException(
        'mode=full has been removed. Use ?reconcile=true instead to force a ' +
          'complete kDrive walk with reconciliation of deleted photos.',
      );
    }

    // reconcile=true disables the "caught up" early-stop optimisation so the
    // kDrive walk completes and the end-of-cycle reconciliation fires. Use
    // this for your nightly FastCron to detect photos deleted directly on
    // kDrive. The normal 30-min cron should NOT pass this flag — it relies
    // on the early stop for speed.
    const forceFullWalk = reconcile === 'true';

    const drives = await this.dbService.db.query.drive.findMany({
      where: inArray(drive.indexStatus, ['COMPLETE', 'ERROR']),
      with: { account: true },
    });

    const label = forceFullWalk ? 'full walk + reconcile' : 'incremental';
    this.logger.log(`Trigger ${label} indexation for ${drives.length} drive(s)`);

    for (const d of drives) {
      this.indexation.indexDrive(d.account.id, d.id, d.kdriveId, false, forceFullWalk);
    }

    return {
      message: `${forceFullWalk ? 'Full walk + reconcile' : 'Incremental'} indexation triggered`,
      count: drives.length,
    };
  }
}
