ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "takenAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "width" integer;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "height" integer;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "cameraMake" text;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "cameraModel" text;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "lensModel" text;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "iso" integer;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "focalLength" real;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "aperture" real;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "shutterSpeed" text;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "gpsLat" real;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "gpsLng" real;--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "exifExtractedAt" timestamp (3);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Photo_driveId_takenAt_idx" ON "Photo" USING btree ("driveId","takenAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Photo_exifExtractedAt_idx" ON "Photo" USING btree ("exifExtractedAt");
