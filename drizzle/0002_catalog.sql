CREATE TABLE "game" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"cover_image_id" text,
	"genres" text[] NOT NULL,
	"platforms" text[] NOT NULL,
	"critic_score" real,
	"critic_score_count" integer,
	"user_score" real,
	"user_score_count" integer,
	"synced_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_date" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"platform" text,
	"region" text NOT NULL,
	"date" timestamp,
	"precision" text NOT NULL,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"query" text PRIMARY KEY NOT NULL,
	"game_ids" integer[] NOT NULL,
	"fetched_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release_date" ADD CONSTRAINT "release_date_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "release_date_gameId_idx" ON "release_date" USING btree ("game_id");