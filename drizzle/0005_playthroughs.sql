CREATE TABLE "playthrough" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"game_id" integer NOT NULL,
	"platform" text NOT NULL,
	"started_on" date NOT NULL,
	"ended_on" date,
	"hours" numeric(7, 2),
	"notes" text DEFAULT '' NOT NULL,
	CONSTRAINT "playthrough_ends_after_start" CHECK ("playthrough"."ended_on" is null or "playthrough"."ended_on" >= "playthrough"."started_on"),
	CONSTRAINT "playthrough_hours_not_negative" CHECK ("playthrough"."hours" is null or "playthrough"."hours" >= 0)
);
--> statement-breakpoint
ALTER TABLE "playthrough" ADD CONSTRAINT "playthrough_user_id_game_id_journal_entry_user_id_game_id_fk" FOREIGN KEY ("user_id","game_id") REFERENCES "public"."journal_entry"("user_id","game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playthrough_userId_gameId_idx" ON "playthrough" USING btree ("user_id","game_id");