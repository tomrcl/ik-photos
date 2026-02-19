import { Controller, Get, Post, Delete, Body, Param, Query, Req, Res, ParseIntPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { count } from 'drizzle-orm';
import archiver from 'archiver';
import { PhotosService } from './photos.service';
import { DrivesService } from '../drives/drives.service';
import { KdriveService } from '../kdrive/kdrive.service';
import { DbService } from '../db/db.service';
import { photo, drive } from '../db/schema';
import { RateLimiter } from '../indexation/rate-limiter';

/** Remove control chars, path separators, and encode for Content-Disposition */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\.{2,}/g, '_')
    .slice(0, 255);
}

@SkipThrottle()
@Controller('drives/:kdriveId/photos')
export class PhotosController {
  constructor(
    private photos: PhotosService,
    private drives: DrivesService,
    private kdrive: KdriveService,
    private dbService: DbService,
    private rateLimiter: RateLimiter,
  ) {}

  @Get()
  async listPhotos(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('beforeDate') beforeDate?: string,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    return this.photos.listPhotos(driveRow.id, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      beforeDate,
    });
  }

  @Get('all')
  async listAllPhotos(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const photos = await this.photos.listAllPhotos(driveRow.id);
    return { photos };
  }

  @Get('years')
  async getYears(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const years = await this.photos.getYears(driveRow.id);
    return { years };
  }

  @Get('months')
  async getMonths(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const months = await this.photos.getMonths(driveRow.id);
    return { months };
  }

  @Get(':id/thumbnail')
  async getThumbnail(
    @Req() req: Request,
    @Res() res: Response,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Param('id') photoId: string,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const foundPhoto = await this.photos.findPhoto(driveRow.id, photoId);

    const token = await this.drives.getDecryptedToken(accountId);
    const buffer = await this.kdrive.fetchThumbnail(token, kdriveId, foundPhoto.kdriveFileId);

    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(buffer);
  }

  @Get(':id/preview')
  async getPreview(
    @Req() req: Request,
    @Res() res: Response,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Param('id') photoId: string,
    @Query('w') w?: string,
    @Query('h') h?: string,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const foundPhoto = await this.photos.findPhoto(driveRow.id, photoId);

    const width = w ? parseInt(w, 10) : 2048;
    const height = h ? parseInt(h, 10) : 2048;

    const token = await this.drives.getDecryptedToken(accountId);
    await this.rateLimiter.acquire(accountId);
    const { buffer, contentType } = await this.kdrive.fetchPreview(token, kdriveId, foundPhoto.kdriveFileId, width, height);

    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  }

  @Get(':id/download')
  async download(
    @Req() req: Request,
    @Res() res: Response,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Param('id') photoId: string,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const foundPhoto = await this.photos.findPhoto(driveRow.id, photoId);

    const token = await this.drives.getDecryptedToken(accountId);
    await this.rateLimiter.acquire(accountId);
    const { buffer, contentType, filename } = await this.kdrive.fetchDownload(token, kdriveId, foundPhoto.kdriveFileId);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(filename)}"`);
    res.send(buffer);
  }

  @Get(':id/stream')
  async stream(
    @Req() req: Request,
    @Res() res: Response,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Param('id') photoId: string,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const foundPhoto = await this.photos.findPhoto(driveRow.id, photoId);

    const token = await this.drives.getDecryptedToken(accountId);
    await this.rateLimiter.acquire(accountId);
    const { buffer, contentType } = await this.kdrive.fetchDownload(token, kdriveId, foundPhoto.kdriveFileId);

    const total = buffer.length;
    const range = req.headers.range;

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;

      if (start >= total || end >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', end - start + 1);
      res.setHeader('Content-Type', contentType);
      res.send(buffer.subarray(start, end + 1));
    } else {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', total);
      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    }
  }

  @Delete()
  async deletePhotos(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Body() body: { photoIds: string[] },
  ) {
    const photoIds = body.photoIds;
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      throw new BadRequestException('photoIds must be a non-empty array');
    }

    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const token = await this.drives.getDecryptedToken(accountId);

    const deletedPhotos = await this.photos.deletePhotos(driveRow.id, photoIds);

    // Delete on kDrive in parallel (best-effort)
    await Promise.allSettled(
      deletedPhotos.map(p => this.kdrive.deleteFile(token, kdriveId, p.kdriveFileId))
    );

    // Update drive photo count
    const [{ value: totalPhotos }] = await this.dbService.db
      .select({ value: count() })
      .from(photo)
      .where(eq(photo.driveId, driveRow.id));

    await this.dbService.db
      .update(drive)
      .set({ totalPhotos })
      .where(eq(drive.id, driveRow.id));

    return { deleted: deletedPhotos.length };
  }

  @Post('download-zip')
  async downloadZip(
    @Req() req: Request,
    @Res() res: Response,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Body() body: { photoIds: string[] },
  ) {
    const photoIds = body.photoIds;
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      throw new BadRequestException('photoIds must be a non-empty array');
    }
    if (photoIds.length > 500) {
      throw new BadRequestException('Maximum 500 photos per ZIP');
    }

    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const foundPhotos = await this.photos.findPhotosByIds(driveRow.id, photoIds);

    if (foundPhotos.length === 0) {
      throw new NotFoundException('No photos found');
    }

    const token = await this.drives.getDecryptedToken(accountId);
    const date = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="photos-${date}.zip"`);

    const archive = archiver('zip', { zlib: { level: 1 } });
    archive.pipe(res);

    // Deduplicate filenames
    const usedNames = new Map<string, number>();
    function uniqueName(name: string): string {
      const cnt = usedNames.get(name) ?? 0;
      usedNames.set(name, cnt + 1);
      if (cnt === 0) return name;
      const dot = name.lastIndexOf('.');
      if (dot === -1) return `${name}_${cnt}`;
      return `${name.slice(0, dot)}_${cnt}${name.slice(dot)}`;
    }

    for (const p of foundPhotos) {
      await this.rateLimiter.acquire(accountId);
      const { stream } = await this.kdrive.fetchDownloadStream(token, kdriveId, p.kdriveFileId);
      archive.append(stream, { name: uniqueName(sanitizeFilename(p.name)) });
    }

    await archive.finalize();
  }
}
