DO $$ BEGIN
  CREATE TYPE "public"."IndexStatus" AS ENUM('PENDING', 'INDEXING', 'COMPLETE', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"infomaniakToken" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "Account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Drive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"kdriveId" integer NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#0098FF' NOT NULL,
	"indexStatus" "IndexStatus" DEFAULT 'PENDING' NOT NULL,
	"lastIndexedAt" timestamp (3),
	"indexCursor" text,
	"minPhotoDate" timestamp (3),
	"maxPhotoDate" timestamp (3),
	"totalPhotos" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driveId" uuid NOT NULL,
	"kdriveFileId" integer NOT NULL,
	"name" text NOT NULL,
	"extension" text NOT NULL,
	"size" bigint NOT NULL,
	"path" text NOT NULL,
	"lastModifiedAt" timestamp (3) NOT NULL,
	"mediaType" text DEFAULT 'image' NOT NULL,
	"hasThumbnail" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "Drive" ADD CONSTRAINT "Drive_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "Photo" ADD CONSTRAINT "Photo_driveId_Drive_id_fk" FOREIGN KEY ("driveId") REFERENCES "public"."Drive"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Drive_accountId_kdriveId_key" ON "Drive" USING btree ("accountId","kdriveId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Photo_driveId_kdriveFileId_key" ON "Photo" USING btree ("driveId","kdriveFileId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Photo_driveId_lastModifiedAt_idx" ON "Photo" USING btree ("driveId","lastModifiedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Photo_lastModifiedAt_idx" ON "Photo" USING btree ("lastModifiedAt");
