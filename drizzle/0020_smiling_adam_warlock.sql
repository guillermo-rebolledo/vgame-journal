CREATE TABLE "steam_link" (
	"user_id" text PRIMARY KEY NOT NULL,
	"steam_id" text NOT NULL,
	"linked_at" timestamp NOT NULL,
	"next_import_at" timestamp,
	CONSTRAINT "steam_link_id_valid" CHECK ("steam_link"."steam_id" ~ '^[0-9]{17}$')
);
--> statement-breakpoint
ALTER TABLE "journal_entry" ADD COLUMN "import_source" text;--> statement-breakpoint
ALTER TABLE "steam_link" ADD CONSTRAINT "steam_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;