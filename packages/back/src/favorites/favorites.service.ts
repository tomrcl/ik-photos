import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { favorite, photo } from '../db/schema';

@Injectable()
export class FavoritesService {
  constructor(private dbService: DbService) {}

  async listFavoriteIds(accountId: string, driveId: string): Promise<string[]> {
    const rows = await this.dbService.db
      .select({ photoId: favorite.photoId })
      .from(favorite)
      .innerJoin(photo, eq(favorite.photoId, photo.id))
      .where(
        and(
          eq(favorite.accountId, accountId),
          eq(photo.driveId, driveId),
          isNull(photo.deletedAt),
        ),
      );
    return rows.map((r) => r.photoId);
  }

  async listFavoritePhotos(accountId: string, driveId: string) {
    const rows = await this.dbService.db
      .select({
        id: photo.id,
        name: photo.name,
        lastModifiedAt: photo.lastModifiedAt,
        takenAt: photo.takenAt,
        hasThumbnail: photo.hasThumbnail,
        mediaType: photo.mediaType,
        favoritedAt: favorite.createdAt,
      })
      .from(favorite)
      .innerJoin(photo, eq(favorite.photoId, photo.id))
      .where(
        and(
          eq(favorite.accountId, accountId),
          eq(photo.driveId, driveId),
          isNull(photo.deletedAt),
        ),
      )
      .orderBy(favorite.createdAt);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      lastModifiedAt: r.lastModifiedAt.toISOString(),
      takenAt: r.takenAt?.toISOString() ?? null,
      hasThumbnail: r.hasThumbnail,
      mediaType: r.mediaType,
      favoritedAt: r.favoritedAt.toISOString(),
    }));
  }

  async toggleFavorite(accountId: string, photoId: string): Promise<boolean> {
    // Check if already favorited
    const existing = await this.dbService.db
      .select({ id: favorite.id })
      .from(favorite)
      .where(and(eq(favorite.accountId, accountId), eq(favorite.photoId, photoId)))
      .limit(1);

    if (existing.length > 0) {
      // Remove
      await this.dbService.db
        .delete(favorite)
        .where(eq(favorite.id, existing[0].id));
      return false;
    } else {
      // Add
      await this.dbService.db
        .insert(favorite)
        .values({ accountId, photoId });
      return true;
    }
  }

  async addFavorites(accountId: string, photoIds: string[]): Promise<number> {
    if (photoIds.length === 0) return 0;
    const result = await this.dbService.db
      .insert(favorite)
      .values(photoIds.map((photoId) => ({ accountId, photoId })))
      .onConflictDoNothing();
    return result.rowCount ?? photoIds.length;
  }

  async verifyPhotoBelongsToDrive(photoId: string, driveId: string): Promise<void> {
    const rows = await this.dbService.db
      .select({ id: photo.id })
      .from(photo)
      .where(and(eq(photo.id, photoId), eq(photo.driveId, driveId), isNull(photo.deletedAt)))
      .limit(1);
    if (rows.length === 0) throw new NotFoundException('Photo not found in this drive');
  }

  async verifyPhotosBelongToDrive(photoIds: string[], driveId: string): Promise<void> {
    if (photoIds.length === 0) return;
    const rows = await this.dbService.db
      .select({ id: photo.id })
      .from(photo)
      .where(and(inArray(photo.id, photoIds), eq(photo.driveId, driveId), isNull(photo.deletedAt)));
    if (rows.length !== photoIds.length) throw new NotFoundException('Some photos not found in this drive');
  }

  async removeFavorites(accountId: string, photoIds: string[]): Promise<number> {
    if (photoIds.length === 0) return 0;
    const result = await this.dbService.db
      .delete(favorite)
      .where(and(eq(favorite.accountId, accountId), inArray(favorite.photoId, photoIds)));
    return result.rowCount ?? 0;
  }
}
