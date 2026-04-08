-- Reset database: drop all tables and recreate from scratch
DROP TABLE IF EXISTS "Favorite" CASCADE;
DROP TABLE IF EXISTS "Photo" CASCADE;
DROP TABLE IF EXISTS "Drive" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TYPE IF EXISTS "IndexStatus" CASCADE;

-- Enum
CREATE TYPE "IndexStatus" AS ENUM ('PENDING', 'INDEXING', 'COMPLETE', 'ERROR');

-- Account
CREATE TABLE "Account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL,
  "infomaniakToken" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now()
);

-- Drive
CREATE TABLE "Drive" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" uuid NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
  "kdriveId" integer NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#0098FF',
  "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING',
  "lastIndexedAt" timestamp(3),
  "indexCursor" text,
  "minPhotoDate" timestamp(3),
  "maxPhotoDate" timestamp(3),
  "totalPhotos" integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "Drive_accountId_kdriveId_key" ON "Drive"("accountId", "kdriveId");

-- Photo
CREATE TABLE "Photo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "driveId" uuid NOT NULL REFERENCES "Drive"("id") ON DELETE CASCADE,
  "kdriveFileId" integer NOT NULL,
  "name" text NOT NULL,
  "extension" text NOT NULL,
  "size" bigint NOT NULL,
  "path" text NOT NULL,
  "lastModifiedAt" timestamp(3) NOT NULL,
  "mediaType" text NOT NULL DEFAULT 'image',
  "hasThumbnail" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "Photo_driveId_kdriveFileId_key" ON "Photo"("driveId", "kdriveFileId");
CREATE INDEX "Photo_driveId_lastModifiedAt_idx" ON "Photo"("driveId", "lastModifiedAt");
CREATE INDEX "Photo_lastModifiedAt_idx" ON "Photo"("lastModifiedAt");

-- Favorite
CREATE TABLE "Favorite" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" uuid NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
  "photoId" uuid NOT NULL REFERENCES "Photo"("id") ON DELETE CASCADE,
  "createdAt" timestamp(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "Favorite_accountId_photoId_key" ON "Favorite"("accountId", "photoId");
CREATE INDEX "Favorite_accountId_idx" ON "Favorite"("accountId");
