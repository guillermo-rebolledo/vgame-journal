ALTER TABLE "journal_entry" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
-- Existing entries: their first status event is when they were added.
UPDATE "journal_entry" SET "created_at" = coalesce((SELECT min("at") FROM "status_event" WHERE "status_event"."user_id" = "journal_entry"."user_id" AND "status_event"."game_id" = "journal_entry"."game_id"), "journal_entry"."updated_at");
