import { relations } from 'drizzle-orm';
import { account, drive, photo } from './schema';

export const accountRelations = relations(account, ({ many }) => ({
  drives: many(drive),
}));

export const driveRelations = relations(drive, ({ one, many }) => ({
  account: one(account, { fields: [drive.accountId], references: [account.id] }),
  photos: many(photo),
}));

export const photoRelations = relations(photo, ({ one }) => ({
  drive: one(drive, { fields: [photo.driveId], references: [drive.id] }),
}));
