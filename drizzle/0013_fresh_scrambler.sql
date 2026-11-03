CREATE TABLE "custom_list" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"submission_id" uuid NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_list_title_valid" CHECK (char_length(btrim("custom_list"."title")) between 1 and 100 and "custom_list"."title" = btrim("custom_list"."title")),
	CONSTRAINT "custom_list_description_valid" CHECK (char_length("custom_list"."description") <= 2000),
	CONSTRAINT "custom_list_visibility_known" CHECK ("custom_list"."visibility" in ('private', 'public')),
	CONSTRAINT "custom_list_revision_valid" CHECK ("custom_list"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "list_entry" (
	"list_id" uuid NOT NULL,
	"game_id" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "list_entry_list_id_game_id_pk" PRIMARY KEY("list_id","game_id"),
	CONSTRAINT "list_entry_position_valid" CHECK ("list_entry"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "custom_list" ADD CONSTRAINT "custom_list_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_entry" ADD CONSTRAINT "list_entry_list_id_custom_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."custom_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_entry" ADD CONSTRAINT "list_entry_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_list_user_submission_idx" ON "custom_list" USING btree ("user_id","submission_id");--> statement-breakpoint
CREATE INDEX "custom_list_user_updated_idx" ON "custom_list" USING btree ("user_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "list_entry_order_idx" ON "list_entry" USING btree ("list_id","position","game_id");