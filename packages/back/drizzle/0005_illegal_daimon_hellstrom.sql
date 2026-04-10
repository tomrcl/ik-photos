DROP INDEX "Photo_driveId_takenAt_idx";--> statement-breakpoint
ALTER TABLE "Photo" ALTER COLUMN "sortDate" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Drive" ADD COLUMN "currentCycleStartedAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "Photo" ADD COLUMN "lastSeenAt" timestamp (3) DEFAULT now() NOT NULL;