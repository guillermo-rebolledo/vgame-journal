CREATE TABLE "discovery_snapshot" (
	"key" text PRIMARY KEY NOT NULL,
	"game_ids" integer[] NOT NULL,
	"first_release_dates" jsonb NOT NULL,
	"refreshed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_refresh" (
	"key" text PRIMARY KEY NOT NULL,
	"next_attempt_at" timestamp NOT NULL
);
