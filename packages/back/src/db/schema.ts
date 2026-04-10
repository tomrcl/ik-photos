import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  real,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const indexStatusEnum = pgEnum('IndexStatus', [
  'PENDING',
  'INDEXING',
  'COMPLETE',
  'ERROR',
]);

export const account = pgTable('Account', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  infomaniakToken: text('infomaniakToken').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date', precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date', precision: 3 }).notNull().$onUpdate(() => new Date()),
});

export const drive = pgTable(
  'Drive',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('accountId')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    kdriveId: integer('kdriveId').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#0098FF'),
    indexStatus: indexStatusEnum('indexStatus').notNull().default('PENDING'),
    lastIndexedAt: timestamp('lastIndexedAt', { mode: 'date', precision: 3 }),
    indexCursor: text('indexCursor'),
    minPhotoDate: timestamp('minPhotoDate', { mode: 'date', precision: 3 }),
    maxPhotoDate: timestamp('maxPhotoDate', { mode: 'date', precision: 3 }),
    totalPhotos: integer('totalPhotos').notNull().default(0),
    // Set when a fresh kDrive walk begins (indexCursor was null). Used by the
    // end-of-cycle reconciliation pass to identify photos that vanished from
    // kDrive (lastSeenAt < currentCycleStartedAt). Cleared when the cycle
    // completes. See IndexationService.runIndexation for the algorithm.
    currentCycleStartedAt: timestamp('currentCycleStartedAt', { mode: 'date', precision: 3 }),
  },
  (t) => [
    uniqueIndex('Drive_accountId_kdriveId_key').on(t.accountId, t.kdriveId),
  ],
);

export const photo = pgTable(
  'Photo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driveId: uuid('driveId')
      .notNull()
      .references(() => drive.id, { onDelete: 'cascade' }),
    kdriveFileId: integer('kdriveFileId').notNull(),
    name: text('name').notNull(),
    extension: text('extension').notNull(),
    size: bigint('size', { mode: 'bigint' }).notNull(),
    path: text('path').notNull(),
    lastModifiedAt: timestamp('lastModifiedAt', { mode: 'date', precision: 3 }).notNull(),
    mediaType: text('mediaType').notNull().default('image'),
    hasThumbnail: boolean('hasThumbnail').notNull().default(false),
    createdAt: timestamp('createdAt', { mode: 'date', precision: 3 }).notNull().defaultNow(),
    // EXIF metadata (all nullable — populated by exif extraction job)
    takenAt: timestamp('takenAt', { mode: 'date', precision: 3 }),
    width: integer('width'),
    height: integer('height'),
    cameraMake: text('cameraMake'),
    cameraModel: text('cameraModel'),
    lensModel: text('lensModel'),
    iso: integer('iso'),
    focalLength: real('focalLength'),
    aperture: real('aperture'),
    shutterSpeed: text('shutterSpeed'),
    gpsLat: real('gpsLat'),
    gpsLng: real('gpsLng'),
    exifExtractedAt: timestamp('exifExtractedAt', { mode: 'date', precision: 3 }),
    // Soft-delete: nullable. When set, the photo is in the Corbeille (trash).
    deletedAt: timestamp('deletedAt', { mode: 'date', precision: 3 }),
    // Bumped on every indexation upsert (insert + onConflictDoUpdate). At the
    // end of a complete kDrive walk, photos with lastSeenAt < drive.currentCycleStartedAt
    // are reconciled (soft-deleted) since they no longer exist on kDrive.
    lastSeenAt: timestamp('lastSeenAt', { mode: 'date', precision: 3 }).notNull().defaultNow(),
    // Stored generated column: COALESCE(takenAt, lastModifiedAt). Used as the
    // canonical sort key for the gallery. Materializing it lets us index it
    // and avoids per-row COALESCE evaluation in ORDER BY / keyset pagination.
    // Always populated by Postgres because lastModifiedAt is NOT NULL — flagged
    // notNull() so the TS layer doesn't have to defensively check.
    sortDate: timestamp('sortDate', { mode: 'date', precision: 3 })
      .generatedAlwaysAs(sql`COALESCE("takenAt", "lastModifiedAt")`)
      .notNull(),
  },
  (t) => [
    uniqueIndex('Photo_driveId_kdriveFileId_key').on(t.driveId, t.kdriveFileId),
    index('Photo_driveId_deletedAt_idx').on(t.driveId, t.deletedAt),
    // Memories partial index: only photos that have a takenAt and aren't trashed.
    index('Photo_driveId_takenAt_partial_idx')
      .on(t.driveId, t.takenAt)
      .where(sql`"takenAt" IS NOT NULL AND "deletedAt" IS NULL`),
    // Gallery sort index — partial on live photos.
    index('Photo_driveId_sortDate_idx')
      .on(t.driveId, t.sortDate)
      .where(sql`"deletedAt" IS NULL`),
    // EXIF backlog: only photos still pending extraction (and not trashed).
    // Replaces Photo_exifExtractedAt_idx (full-table) — much smaller.
    index('Photo_exifExtractedAt_partial_idx')
      .on(t.exifExtractedAt)
      .where(sql`"exifExtractedAt" IS NULL AND "deletedAt" IS NULL`),
    // Trash retention purge: only rows currently in the trash.
    index('Photo_deletedAt_partial_idx')
      .on(t.deletedAt)
      .where(sql`"deletedAt" IS NOT NULL`),
  ],
);

export const favorite = pgTable(
  'Favorite',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('accountId')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    photoId: uuid('photoId')
      .notNull()
      .references(() => photo.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { mode: 'date', precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('Favorite_accountId_photoId_key').on(t.accountId, t.photoId),
    index('Favorite_accountId_idx').on(t.accountId),
  ],
);
