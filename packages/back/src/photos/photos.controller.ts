import { Controller, Get, Post, Delete, Body, Param, Query, Req, Res, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import archiver from 'archiver';
import sharp from 'sharp';
import { PhotosService } from './photos.service';
import { DrivesService } from '../drives/drives.service';
import { KdriveService } from '../kdrive/kdrive.service';
import { RateLimiter } from '../indexation/rate-limiter';
import { BulkPhotoIdsDto } from './dto/photo-ids.dto';

/** Remove control chars, path separators, and encode for Content-Disposition */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\.{2,}/g, '_')
    .slice(0, 255);
}

// SkipThrottle is applied selectively to read endpoints below — the gallery
// fans out lots of /thumbnail and /preview requests and would otherwise hit
// the global rate limit. Mutation endpoints (rotate, bulk delete) are NOT
// skipped: they remain rate-limited.
@Controller('drives/:kdriveId/photos')
export class PhotosController {
  constructor(
    private photos: PhotosService,
    private drives: DrivesService,
    private kdrive: KdriveService,
    private rateLimiter: RateLimiter,
  ) {}

  @SkipThrottle()
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

  @SkipThrottle()
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

  @SkipThrottle()
  @Get('geo')
  async listGeoPhotos(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const photos = await this.photos.listGeoPhotos(driveRow.id);
    return { photos };
  }

  @SkipThrottle()
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

  @SkipThrottle()
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

  @SkipThrottle()
  @Get('memories')
  async getMemories(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    return this.photos.getMemories(driveRow.id);
  }

  @SkipThrottle()
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

  @SkipThrottle()
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

    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  }

  @SkipThrottle()
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

  @SkipThrottle()
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

    const range = req.headers.range;

    // Without Range header: stream directly without buffering
    if (!range) {
      const { stream, filename } = await this.kdrive.fetchDownloadStream(token, kdriveId, foundPhoto.kdriveFileId);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      stream.pipe(res);
      return;
    }

    // With Range header: kDrive API doesn't support Range requests,
    // so we must buffer the full file to serve partial content.
    // This is a known limitation — only impacts videos (images use /preview).
    const { buffer, contentType } = await this.kdrive.fetchDownload(token, kdriveId, foundPhoto.kdriveFileId);

    const total = buffer.length;
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
  }

  @Post(':id/rotate')
  async rotatePhoto(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Param('id') photoId: string,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const foundPhoto = await this.photos.findPhoto(driveRow.id, photoId);

    const token = await this.drives.getDecryptedToken(accountId);
    await this.rateLimiter.acquire(accountId);
    const fileInfo = await this.kdrive.getFileInfo(token, kdriveId, foundPhoto.kdriveFileId);
    const { buffer, contentType } = await this.kdrive.fetchDownload(token, kdriveId, foundPhoto.kdriveFileId);

    const meta = await sharp(buffer).metadata();
    let pipeline = sharp(buffer).rotate(90).withMetadata();
    if (meta.format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: 100 });
    } else if (meta.format === 'png') {
      pipeline = pipeline.png();
    } else if (meta.format === 'webp') {
      pipeline = pipeline.webp({ quality: 100 });
    }
    const rotated = await pipeline.toBuffer();
    await this.kdrive.uploadFile(token, kdriveId, foundPhoto.kdriveFileId, rotated, contentType, fileInfo.last_modified_at);

    return { ok: true };
  }

  @Delete()
  async deletePhotos(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Body() body: BulkPhotoIdsDto,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);

    // Soft delete — photos move to the Corbeille. kDrive is untouched.
    const deleted = await this.photos.softDeletePhotos(driveRow.id, body.photoIds);

    // Incremental adjust on drive.totalPhotos. The full self-healing recount
    // still runs at the end of indexation, so any drift gets corrected.
    if (deleted > 0) {
      await this.photos.adjustDriveTotalPhotos(driveRow.id, -deleted);
    }

    return { deleted };
  }

  @Post('download-zip')
  async downloadZip(
    @Req() req: Request,
    @Res() res: Response,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Body() body: BulkPhotoIdsDto,
  ) {
    const photoIds = body.photoIds;

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
