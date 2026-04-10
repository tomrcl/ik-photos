ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp (3);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Photo_driveId_deletedAt_idx" ON "Photo" USING btree ("driveId","deletedAt");