CREATE TABLE "journal_entry" (
	"user_id" text NOT NULL,
	"game_id" integer NOT NULL,
	"status" text NOT NULL,
	"completion_tag" text,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "journal_entry_user_id_game_id_pk" PRIMARY KEY("user_id","game_id"),
	CONSTRAINT "journal_entry_tag_only_when_played" CHECK ("journal_entry"."completion_tag" is null or "journal_entry"."status" = 'played')
);
--> statement-breakpoint
CREATE TABLE "status_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"game_id" integer NOT NULL,
	"status" text,
	"completion_tag" text,
	"at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_event" ADD CONSTRAINT "status_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_event" ADD CONSTRAINT "status_event_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_event_userId_idx" ON "status_event" USING btree ("user_id");