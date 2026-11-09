CREATE TABLE "refresh_task" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled_at" timestamp DEFAULT now() NOT NULL,
	"attempted_at" timestamp,
	"started_at" timestamp,
	"finished_at" timestamp,
	"outcome" text,
	"last_success_at" timestamp,
	"last_skipped_at" timestamp
);

--> statement-breakpoint
INSERT INTO "refresh_task" ("key") VALUES ('daily'), ('wishlist'), ('recent'), ('popular');
