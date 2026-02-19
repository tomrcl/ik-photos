import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

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
  },
  (t) => [
    uniqueIndex('Photo_driveId_kdriveFileId_key').on(t.driveId, t.kdriveFileId),
    index('Photo_driveId_lastModifiedAt_idx').on(t.driveId, t.lastModifiedAt),
    index('Photo_lastModifiedAt_idx').on(t.lastModifiedAt),
  ],
);
