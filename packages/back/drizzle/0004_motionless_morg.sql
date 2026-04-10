DROP INDEX "Photo_driveId_lastModifiedAt_idx";--> statement-breakpoint
DROP INDEX "Photo_lastModifiedAt_idx";--> statement-breakpoint
DROP INDEX "Photo_exifExtractedAt_idx";--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN "sortDate" timestamp (3) GENERATED ALWAYS AS (COALESCE("takenAt", "lastModifiedAt")) STORED;--> statement-breakpoint
CREATE INDEX "Photo_driveId_takenAt_partial_idx" ON "Photo" USING btree ("driveId","takenAt") WHERE "takenAt" IS NOT NULL AND "deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "Photo_driveId_sortDate_idx" ON "Photo" USING btree ("driveId","sortDate") WHERE "deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "Photo_exifExtractedAt_partial_idx" ON "Photo" USING btree ("exifExtractedAt") WHERE "exifExtractedAt" IS NULL AND "deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "Photo_deletedAt_partial_idx" ON "Photo" USING btree ("deletedAt") WHERE "deletedAt" IS NOT NULL;