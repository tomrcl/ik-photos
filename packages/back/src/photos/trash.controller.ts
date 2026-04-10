import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PhotosService } from './photos.service';
import { DrivesService } from '../drives/drives.service';
import { KdriveService } from '../kdrive/kdrive.service';
import { PhotoIdsDto } from './dto/photo-ids.dto';
import { pMap } from '../common/p-map';

const KDRIVE_DELETE_CONCURRENCY = 6;

@Controller('drives/:kdriveId/trash')
export class TrashController {
  private readonly logger = new Logger(TrashController.name);

  constructor(
    private photos: PhotosService,
    private drives: DrivesService,
    private kdrive: KdriveService,
  ) {}

  /** List trashed photos for a drive — paginated, deletedAt DESC. */
  @Get()
  async listTrash(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    return this.photos.listTrashedPhotos(driveRow.id, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** Restore photos from the Corbeille back to the live gallery. */
  @Post('restore')
  async restore(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Body() body: PhotoIdsDto,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const restored = await this.photos.restoreFromTrash(driveRow.id, body.ids);

    // Incremental adjust: restore brings rows back into the live count.
    if (restored > 0) {
      await this.photos.adjustDriveTotalPhotos(driveRow.id, restored);
    }

    return { restored };
  }

  /**
   * Permanently delete photos. Requires a non-empty `ids` array — emptying the
   * entire trash in one call is no longer supported (the previous behaviour
   * was a footgun).
   */
  @Delete()
  async permanentDelete(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Body() body: PhotoIdsDto,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const token = await this.drives.getDecryptedToken(accountId);

    const trashed = await this.photos.findTrashedForHardDelete(driveRow.id, body.ids);
    if (trashed.length === 0) return { deleted: 0 };

    // Delete on kDrive (best-effort) with bounded concurrency: 404 means
    // already gone — still purge from DB. The previous unbounded
    // Promise.allSettled would happily fan out to hundreds of parallel
    // requests against the kDrive API.
    const results = await pMap(trashed, KDRIVE_DELETE_CONCURRENCY, (p) =>
      this.kdrive.deleteFile(accountId, token, kdriveId, p.kdriveFileId),
    );

    const toPurgeFromDb: string[] = [];
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        toPurgeFromDb.push(trashed[i].id);
      } else {
        const msg = (res.reason as Error)?.message ?? 'unknown error';
        // kdrive.deleteFile already swallows 404. Anything else here is a real
        // failure — keep the row in the DB so the user can retry later.
        this.logger.warn(
          `kDrive delete failed for photo ${trashed[i].id} (kdriveFileId=${trashed[i].kdriveFileId}): ${msg}`,
        );
      }
    });

    await this.photos.hardDeleteByIds(toPurgeFromDb);

    // No drive.totalPhotos change: trashed rows were already excluded from
    // the live count when they were soft-deleted.
    return { deleted: toPurgeFromDb.length };
  }
}
