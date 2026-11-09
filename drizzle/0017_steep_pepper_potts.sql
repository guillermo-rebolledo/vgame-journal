ALTER TABLE "user" ADD COLUMN "profile_visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_profile_visibility_known" CHECK ("user"."profile_visibility" in ('private', 'public'));
--> statement-breakpoint
UPDATE "user" SET "profile_visibility" = 'public';
