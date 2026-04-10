import { Controller, Get, Post, Param, Query, Req, ParseIntPipe } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { DrivesService } from './drives.service';
import { IndexationService } from '../indexation/indexation.service';

// SkipThrottle is applied selectively to the read endpoints below — the
// gallery polls /drives and /:kdriveId/status frequently. The write path
// (POST /:kdriveId/index) remains throttled to prevent abuse, especially
// since it can trigger resetDrive when called with mode=full.
@Controller('drives')
export class DrivesController {
  constructor(
    private drives: DrivesService,
    private indexation: IndexationService,
  ) {}

  @SkipThrottle()
  @Get()
  async listDrives(@Req() req: Request, @Query('sync') sync?: string) {
    const accountId = (req as any).user.sub;
    // sync=true: first load, sync with kDrive API
    // otherwise: lightweight DB read (suitable for polling)
    const drives = sync === 'true'
      ? await this.drives.syncDrives(accountId)
      : await this.drives.listDrives(accountId);
    return {
      drives: drives.map((d) => ({
        id: d.id,
        kdriveId: d.kdriveId,
        name: d.name,
        color: d.color,
        indexStatus: d.indexStatus,
        lastIndexedAt: d.lastIndexedAt?.toISOString() ?? null,
        totalPhotos: d.totalPhotos,
        minPhotoDate: d.minPhotoDate?.toISOString() ?? null,
        maxPhotoDate: d.maxPhotoDate?.toISOString() ?? null,
      })),
    };
  }

  @Post(':kdriveId/index')
  async startIndex(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Query('force') force?: string,
    @Query('mode') mode?: string,
  ) {
    const accountId = (req as any).user.sub;
    const drive = await this.drives.findDrive(accountId, kdriveId);
    if (mode === 'full') {
      await this.drives.resetDrive(drive.id);
    }
    // Set INDEXING synchronously so the front sees it immediately on refetch
    await this.drives.setIndexing(drive.id);
    this.indexation.indexDrive(accountId, drive.id, kdriveId, force === 'true');
    return { message: 'Indexation started' };
  }

  @SkipThrottle()
  @Get(':kdriveId/status')
  async getStatus(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
  ) {
    const accountId = (req as any).user.sub;
    return this.drives.getDriveStatus(accountId, kdriveId);
  }
}
