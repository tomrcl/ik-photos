import { Controller, Get, Post, Delete, Body, Param, Req, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { FavoritesService } from './favorites.service';
import { DrivesService } from '../drives/drives.service';

@SkipThrottle()
@Controller('drives/:kdriveId/favorites')
export class FavoritesController {
  constructor(
    private favorites: FavoritesService,
    private drives: DrivesService,
  ) {}

  /** Get all favorite photo IDs for this drive */
  @Get()
  async listFavorites(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const photoIds = await this.favorites.listFavoriteIds(accountId, driveRow.id);
    return { photoIds };
  }

  /** Get full favorite photos list for this drive */
  @Get('photos')
  async listFavoritePhotos(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    const photos = await this.favorites.listFavoritePhotos(accountId, driveRow.id);
    return { photos };
  }

  /** Toggle a single photo's favorite status */
  @Post(':photoId/toggle')
  async toggleFavorite(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Param('photoId') photoId: string,
  ) {
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    await this.favorites.verifyPhotoBelongsToDrive(photoId, driveRow.id);
    const favorited = await this.favorites.toggleFavorite(accountId, photoId);
    return { favorited };
  }

  /** Add multiple photos to favorites */
  @Post('bulk')
  async addBulkFavorites(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Body() body: { photoIds: string[] },
  ) {
    if (!Array.isArray(body.photoIds) || body.photoIds.length === 0) {
      throw new BadRequestException('photoIds must be a non-empty array');
    }
    const accountId = (req as any).user.sub;
    const driveRow = await this.drives.findDrive(accountId, kdriveId);
    await this.favorites.verifyPhotosBelongToDrive(body.photoIds, driveRow.id);
    const added = await this.favorites.addFavorites(accountId, body.photoIds);
    return { added };
  }

  /** Remove multiple photos from favorites */
  @Delete('bulk')
  async removeBulkFavorites(
    @Req() req: Request,
    @Param('kdriveId', ParseIntPipe) kdriveId: number,
    @Body() body: { photoIds: string[] },
  ) {
    if (!Array.isArray(body.photoIds) || body.photoIds.length === 0) {
      throw new BadRequestException('photoIds must be a non-empty array');
    }
    const accountId = (req as any).user.sub;
    await this.drives.findDrive(accountId, kdriveId);
    const removed = await this.favorites.removeFavorites(accountId, body.photoIds);
    return { removed };
  }
}
