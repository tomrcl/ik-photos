import { relations } from 'drizzle-orm';
import { account, drive, photo, favorite } from './schema';

export const accountRelations = relations(account, ({ many }) => ({
  drives: many(drive),
  favorites: many(favorite),
}));

export const driveRelations = relations(drive, ({ one, many }) => ({
  account: one(account, { fields: [drive.accountId], references: [account.id] }),
  photos: many(photo),
}));

export const photoRelations = relations(photo, ({ one, many }) => ({
  drive: one(drive, { fields: [photo.driveId], references: [drive.id] }),
  favorites: many(favorite),
}));

export const favoriteRelations = relations(favorite, ({ one }) => ({
  account: one(account, { fields: [favorite.accountId], references: [account.id] }),
  photo: one(photo, { fields: [favorite.photoId], references: [photo.id] }),
}));
