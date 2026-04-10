import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, inArray, isNull, isNotNull, sql, desc } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { photo, drive } from '../db/schema';

type PhotoRow = typeof photo.$inferSelect;

// Hard cap on /geo to keep payload bounded on huge drives.
const GEO_HARD_CAP = 5000;

// Serialize a photo row to the API response shape. Includes EXIF fields when present.
function serializePhoto(p: PhotoRow) {
  return {
    id: p.id,
    kdriveFileId: p.kdriveFileId,
    name: p.name,
    extension: p.extension,
    size: Number(p.size),
    path: p.path,
    lastModifiedAt: p.lastModifiedAt.toISOString(),
    hasThumbnail: p.hasThumbnail,
    mediaType: p.mediaType,
    // EXIF fields — null when not yet extracted or missing
    takenAt: p.takenAt?.toISOString() ?? null,
    width: p.width,
    height: p.height,
    cameraMake: p.cameraMake,
    cameraModel: p.cameraModel,
    lensModel: p.lensModel,
    iso: p.iso,
    focalLength: p.focalLength,
    aperture: p.aperture,
    shutterSpeed: p.shutterSpeed,
    gpsLat: p.gpsLat,
    gpsLng: p.gpsLng,
    // Soft-delete marker — null when photo is live, ISO string when in Corbeille
    deletedAt: p.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class PhotosService {
  constructor(private dbService: DbService) {}

  async listPhotos(
    driveId: string,
    options: { cursor?: string; limit?: number; year?: number; month?: number; beforeDate?: string },
  ) {
    const limit = options.limit ?? 200;
    const conditions = [eq(photo.driveId, driveId), isNull(photo.deletedAt)];

    if (options.year) {
      const start = new Date(options.year, (options.month ?? 1) - 1, 1);
      const end = options.month
        ? new Date(options.year, options.month, 1)
        : new Date(options.year + 1, 0, 1);
      conditions.push(sql`${photo.sortDate} >= ${start}`);
      conditions.push(sql`${photo.sortDate} < ${end}`);
    } else if (options.beforeDate) {
      conditions.push(sql`${photo.sortDate} < ${new Date(options.beforeDate)}`);
    }

    if (options.cursor) {
      // Keyset pagination: fetch the cursor row to get effective sort key + id
      const [cursorRow] = await this.dbService.db
        .select({ sortDate: photo.sortDate, id: photo.id })
        .from(photo)
        .where(eq(photo.id, options.cursor))
        .limit(1);

      if (cursorRow) {
        conditions.push(
          sql`(${photo.sortDate}, ${photo.id}) < (${cursorRow.sortDate}, ${cursorRow.id})`,
        );
      }
    }

    const photos = await this.dbService.db
      .select()
      .from(photo)
      .where(and(...conditions))
      .orderBy(desc(photo.sortDate), desc(photo.id))
      .limit(limit + 1);

    const hasMore = photos.length > limit;
    const results = hasMore ? photos.slice(0, limit) : photos;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return {
      photos: results.map((p) => serializePhoto(p)),
      cursor: nextCursor,
    };
  }

  /**
   * List geo-located photos for a drive. Returns only photos that have both
   * GPS coordinates populated (from EXIF extraction) and are not trashed.
   * Minimal payload — the map view fetches thumbnails lazily by id.
   *
   * Hard-capped at GEO_HARD_CAP rows to prevent runaway responses on huge
   * drives. The cap is silent (LIMIT only); the frontend continues to read
   * the array directly. If you need to surface the cap to the UI, expose a
   * `capped` flag here and update the controller — the simplest approach is
   * to keep the array shape unchanged for now.
   */
  async listGeoPhotos(driveId: string) {
    const photos = await this.dbService.db
      .select({
        id: photo.id,
        lat: photo.gpsLat,
        lng: photo.gpsLng,
        takenAt: photo.takenAt,
      })
      .from(photo)
      .where(
        and(
          eq(photo.driveId, driveId),
          isNull(photo.deletedAt),
          isNotNull(photo.gpsLat),
          isNotNull(photo.gpsLng),
        ),
      )
      // Deterministic order: newer photos win on a tie-broken sort so the
      // GEO_HARD_CAP slice is stable across refreshes instead of returning
      // a random subset on drives with >5000 geolocated photos.
      .orderBy(desc(photo.sortDate), desc(photo.id))
      .limit(GEO_HARD_CAP);

    return photos.map((p) => ({
      id: p.id,
      lat: p.lat as number,
      lng: p.lng as number,
      takenAt: p.takenAt?.toISOString() ?? null,
    }));
  }

  async listAllPhotos(driveId: string) {
    const photos = await this.dbService.db
      .select({
        id: photo.id,
        name: photo.name,
        lastModifiedAt: photo.lastModifiedAt,
        takenAt: photo.takenAt,
        hasThumbnail: photo.hasThumbnail,
        mediaType: photo.mediaType,
      })
      .from(photo)
      .where(and(eq(photo.driveId, driveId), isNull(photo.deletedAt)))
      .orderBy(desc(photo.sortDate), desc(photo.id));

    return photos.map((p) => ({
      id: p.id,
      name: p.name,
      lastModifiedAt: p.lastModifiedAt.toISOString(),
      takenAt: p.takenAt?.toISOString() ?? null,
      hasThumbnail: p.hasThumbnail,
      mediaType: p.mediaType,
    }));
  }

  async getYears(driveId: string) {
    const results = await this.dbService.db.execute<{ year: number; count: string }>(sql`
      SELECT EXTRACT(YEAR FROM "sortDate")::int AS year,
             COUNT(*)::bigint AS count
      FROM "Photo"
      WHERE "driveId" = ${driveId} AND "deletedAt" IS NULL
      GROUP BY year
      ORDER BY year DESC
    `);
    return results.rows.map((r) => ({ year: r.year, count: Number(r.count) }));
  }

  async getMonths(driveId: string) {
    const results = await this.dbService.db.execute<{ year: number; month: number; count: string }>(sql`
      SELECT EXTRACT(YEAR FROM "sortDate")::int AS year,
             EXTRACT(MONTH FROM "sortDate")::int AS month,
             COUNT(*)::bigint AS count
      FROM "Photo"
      WHERE "driveId" = ${driveId} AND "deletedAt" IS NULL
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `);
    return results.rows.map((r) => ({ year: r.year, month: r.month, count: Number(r.count) }));
  }

  /**
   * Return photos taken on the same calendar day (month + day) as today, in
   * previous years. Grouped by year (descending, most recent first), capped
   * to 20 photos per year. Only considers live photos with a known takenAt.
   */
  // For drives >100k photos, consider stored generated columns (takenMonth/takenDay) or a materialized view to make this fully sargable.
  async getMemories(driveId: string) {
    // Resolve "today" in the configured memories timezone so that the JS side
    // and the Postgres side agree on what calendar day we're looking at.
    // Without this, `new Date().getMonth()/getDate()` uses server local time
    // while `EXTRACT(...)` runs in the Postgres session TZ (usually UTC),
    // causing drift around midnight.
    const tz = process.env.MEMORIES_TIMEZONE ?? 'UTC';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const todayMonth = pick('month');
    const todayDay = pick('day');
    const currentYear = pick('year');

    // Fetch candidate photos in one query, then group + cap per year in JS.
    // Ordered by year DESC then takenAt DESC so the in-JS slice(0, 20) keeps
    // the most recent shots of each given day. The id tiebreaker keeps the
    // order stable across requests when multiple photos share a takenAt.
    const rows = await this.dbService.db
      .select()
      .from(photo)
      .where(
        and(
          eq(photo.driveId, driveId),
          isNull(photo.deletedAt),
          isNotNull(photo.takenAt),
          sql`EXTRACT(MONTH FROM (${photo.takenAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) = ${todayMonth}`,
          sql`EXTRACT(DAY FROM (${photo.takenAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) = ${todayDay}`,
          sql`EXTRACT(YEAR FROM (${photo.takenAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) < ${currentYear}`,
        ),
      )
      .orderBy(desc(photo.takenAt), desc(photo.id));

    const byYear = new Map<number, PhotoRow[]>();
    for (const row of rows) {
      if (!row.takenAt) continue;
      const year = row.takenAt.getFullYear();
      const bucket = byYear.get(year);
      if (bucket) {
        if (bucket.length < 20) bucket.push(row);
      } else {
        byYear.set(year, [row]);
      }
    }

    const years = Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, photos]) => ({
        year,
        yearsAgo: currentYear - year,
        photos: photos.map((p) => serializePhoto(p)),
      }));

    return { years };
  }

  async findPhotosByIds(driveId: string, photoIds: string[]) {
    return this.dbService.db
      .select({ id: photo.id, kdriveFileId: photo.kdriveFileId, name: photo.name })
      .from(photo)
      .where(and(eq(photo.driveId, driveId), inArray(photo.id, photoIds), isNull(photo.deletedAt)));
  }

  /**
   * Soft-delete photos: mark with deletedAt = now(). kDrive is untouched — the photos
   * remain in kDrive until they are restored (cleared deletedAt) or permanently deleted
   * from the Corbeille (hard delete) or purged by the retention cron.
   */
  async softDeletePhotos(driveId: string, photoIds: string[]): Promise<number> {
    if (photoIds.length === 0) return 0;
    const now = new Date();
    const result = await this.dbService.db
      .update(photo)
      .set({ deletedAt: now })
      .where(
        and(
          eq(photo.driveId, driveId),
          inArray(photo.id, photoIds),
          isNull(photo.deletedAt),
        ),
      );
    return result.rowCount ?? 0;
  }

  /**
   * List trashed photos for a drive, ordered by deletedAt DESC. Supports keyset
   * pagination via cursor (last returned photo id).
   */
  async listTrashedPhotos(
    driveId: string,
    options: { cursor?: string; limit?: number },
  ) {
    const limit = options.limit ?? 200;
    const conditions = [eq(photo.driveId, driveId), isNotNull(photo.deletedAt)];

    if (options.cursor) {
      const [cursorRow] = await this.dbService.db
        .select({ deletedAt: photo.deletedAt, id: photo.id })
        .from(photo)
        .where(eq(photo.id, options.cursor))
        .limit(1);

      if (cursorRow && cursorRow.deletedAt) {
        conditions.push(
          sql`(${photo.deletedAt}, ${photo.id}) < (${cursorRow.deletedAt}, ${cursorRow.id})`,
        );
      }
    }

    const photos = await this.dbService.db
      .select()
      .from(photo)
      .where(and(...conditions))
      .orderBy(desc(photo.deletedAt), desc(photo.id))
      .limit(limit + 1);

    const hasMore = photos.length > limit;
    const results = hasMore ? photos.slice(0, limit) : photos;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return {
      photos: results.map((p) => serializePhoto(p)),
      cursor: nextCursor,
    };
  }

  /** Restore previously-trashed photos back into the live gallery. */
  async restoreFromTrash(driveId: string, photoIds: string[]): Promise<number> {
    if (photoIds.length === 0) return 0;
    const result = await this.dbService.db
      .update(photo)
      .set({ deletedAt: null })
      .where(
        and(
          eq(photo.driveId, driveId),
          inArray(photo.id, photoIds),
          isNotNull(photo.deletedAt),
        ),
      );
    return result.rowCount ?? 0;
  }

  /**
   * Fetch trashed photos (id + kdriveFileId) for hard-delete. If photoIds is
   * undefined or empty, returns ALL trashed photos for this drive.
   */
  async findTrashedForHardDelete(
    driveId: string,
    photoIds?: string[],
  ): Promise<{ id: string; kdriveFileId: number }[]> {
    const conditions = [eq(photo.driveId, driveId), isNotNull(photo.deletedAt)];
    if (photoIds && photoIds.length > 0) {
      conditions.push(inArray(photo.id, photoIds));
    }
    return this.dbService.db
      .select({ id: photo.id, kdriveFileId: photo.kdriveFileId })
      .from(photo)
      .where(and(...conditions));
  }

  /** Delete rows from the DB (after kDrive deletion). */
  async hardDeleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.dbService.db.delete(photo).where(inArray(photo.id, ids));
  }

  /**
   * Adjust drive.totalPhotos incrementally. delta can be negative (soft delete)
   * or positive (restore). Floors at 0 to avoid negative counts if the row
   * count drifts. The full count() is only used as a self-healing safety net
   * at the end of indexation.
   */
  async adjustDriveTotalPhotos(driveId: string, delta: number): Promise<void> {
    if (delta === 0) return;
    await this.dbService.db
      .update(drive)
      .set({ totalPhotos: sql`GREATEST(0, "totalPhotos" + ${delta})` })
      .where(eq(drive.id, driveId));
  }

  async findPhoto(driveId: string, photoId: string) {
    const rows = await this.dbService.db
      .select()
      .from(photo)
      .innerJoin(drive, eq(photo.driveId, drive.id))
      .where(and(eq(photo.id, photoId), eq(photo.driveId, driveId), isNull(photo.deletedAt)))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('Photo not found');
    return { ...rows[0].Photo, drive: rows[0].Drive };
  }
}
