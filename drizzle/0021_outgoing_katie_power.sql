ALTER TABLE "session" ADD COLUMN "review_dismissed_year" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "review_viewed_year" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "review_hidden_year" integer;