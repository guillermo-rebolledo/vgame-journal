CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "profile_visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX "rate_limit_last_request_idx" ON "rate_limit" USING btree ("last_request");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_profile_visibility_known" CHECK ("user"."profile_visibility" in ('private', 'public'));
--> statement-breakpoint
UPDATE "user" SET "profile_visibility" = 'public';
