ALTER TABLE "journal_entry" ADD COLUMN "rating" smallint;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD COLUMN "rated_at" timestamp;--> statement-breakpoint
CREATE INDEX "journal_entry_game_rating_idx" ON "journal_entry" USING btree ("game_id","rating") WHERE "journal_entry"."rating" is not null;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_rating_range" CHECK ("journal_entry"."rating" is null or "journal_entry"."rating" between 1 and 10);--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_rated_at_with_rating" CHECK (("journal_entry"."rating" is null) = ("journal_entry"."rated_at" is null));