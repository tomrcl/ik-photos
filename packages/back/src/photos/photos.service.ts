import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lt, desc, inArray, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { photo, drive } from '../db/schema';

@Injectable()
export class PhotosService {
  constructor(private dbService: DbService) {}

  async listPhotos(
    driveId: string,
    options: { cursor?: string; limit?: number; year?: number; month?: number; beforeDate?: string },
  ) {
    const limit = options.limit ?? 200;
    const conditions = [eq(photo.driveId, driveId)];

    if (options.year) {
      const start = new Date(options.year, (options.month ?? 1) - 1, 1);
      const end = options.month
        ? new Date(options.year, options.month, 1)
        : new Date(options.year + 1, 0, 1);
      conditions.push(gte(photo.lastModifiedAt, start));
      conditions.push(lt(photo.lastModifiedAt, end));
    } else if (options.beforeDate) {
      conditions.push(lt(photo.lastModifiedAt, new Date(options.beforeDate)));
    }

    if (options.cursor) {
      // Keyset pagination: fetch the cursor row to get lastModifiedAt + id
      const [cursorRow] = await this.dbService.db
        .select({ lastModifiedAt: photo.lastModifiedAt, id: photo.id })
        .from(photo)
        .where(eq(photo.id, options.cursor))
        .limit(1);

      if (cursorRow) {
        conditions.push(
          sql`(${photo.lastModifiedAt}, ${photo.id}) < (${cursorRow.lastModifiedAt}, ${cursorRow.id})`,
        );
      }
    }

    const photos = await this.dbService.db
      .select()
      .from(photo)
      .where(and(...conditions))
      .orderBy(desc(photo.lastModifiedAt), desc(photo.id))
      .limit(limit + 1);

    const hasMore = photos.length > limit;
    const results = hasMore ? photos.slice(0, limit) : photos;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return {
      photos: results.map((p) => ({
        id: p.id,
        kdriveFileId: p.kdriveFileId,
        name: p.name,
        extension: p.extension,
        size: Number(p.size),
        path: p.path,
        lastModifiedAt: p.lastModifiedAt.toISOString(),
        hasThumbnail: p.hasThumbnail,
        mediaType: p.mediaType,
      })),
      cursor: nextCursor,
    };
  }

  async listAllPhotos(driveId: string) {
    const photos = await this.dbService.db
      .select({
        id: photo.id,
        name: photo.name,
        lastModifiedAt: photo.lastModifiedAt,
        hasThumbnail: photo.hasThumbnail,
        mediaType: photo.mediaType,
      })
      .from(photo)
      .where(eq(photo.driveId, driveId))
      .orderBy(desc(photo.lastModifiedAt));

    return photos.map((p) => ({
      id: p.id,
      name: p.name,
      lastModifiedAt: p.lastModifiedAt.toISOString(),
      hasThumbnail: p.hasThumbnail,
      mediaType: p.mediaType,
    }));
  }

  async getYears(driveId: string) {
    const results = await this.dbService.db.execute<{ year: number; count: string }>(sql`
      SELECT EXTRACT(YEAR FROM "lastModifiedAt")::int AS year, COUNT(*)::bigint AS count
      FROM "Photo"
      WHERE "driveId" = ${driveId}
      GROUP BY year
      ORDER BY year DESC
    `);
    return results.rows.map((r) => ({ year: r.year, count: Number(r.count) }));
  }

  async getMonths(driveId: string) {
    const results = await this.dbService.db.execute<{ year: number; month: number; count: string }>(sql`
      SELECT EXTRACT(YEAR FROM "lastModifiedAt")::int AS year,
             EXTRACT(MONTH FROM "lastModifiedAt")::int AS month,
             COUNT(*)::bigint AS count
      FROM "Photo"
      WHERE "driveId" = ${driveId}
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `);
    return results.rows.map((r) => ({ year: r.year, month: r.month, count: Number(r.count) }));
  }

  async findPhotosByIds(driveId: string, photoIds: string[]) {
    return this.dbService.db
      .select({ id: photo.id, kdriveFileId: photo.kdriveFileId, name: photo.name })
      .from(photo)
      .where(and(eq(photo.driveId, driveId), inArray(photo.id, photoIds)));
  }

  async deletePhotos(driveId: string, photoIds: string[]): Promise<{ id: string; kdriveFileId: number }[]> {
    const photos = await this.dbService.db
      .select({ id: photo.id, kdriveFileId: photo.kdriveFileId })
      .from(photo)
      .where(and(eq(photo.driveId, driveId), inArray(photo.id, photoIds)));

    if (photos.length > 0) {
      await this.dbService.db
        .delete(photo)
        .where(inArray(photo.id, photos.map((p) => p.id)));
    }

    return photos;
  }

  async findPhoto(driveId: string, photoId: string) {
    const rows = await this.dbService.db
      .select()
      .from(photo)
      .innerJoin(drive, eq(photo.driveId, drive.id))
      .where(eq(photo.id, photoId))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('Photo not found');
    return { ...rows[0].Photo, drive: rows[0].Drive };
  }
}
