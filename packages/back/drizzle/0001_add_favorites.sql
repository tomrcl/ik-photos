CREATE TABLE "Favorite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"photoId" uuid NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_photoId_Photo_id_fk" FOREIGN KEY ("photoId") REFERENCES "public"."Photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "Favorite_accountId_photoId_key" ON "Favorite" USING btree ("accountId","photoId");--> statement-breakpoint
CREATE INDEX "Favorite_accountId_idx" ON "Favorite" USING btree ("accountId");
