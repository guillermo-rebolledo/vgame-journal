ALTER TABLE "user" ADD COLUMN "feed_token" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_feed_token_unique" UNIQUE("feed_token");