ALTER TABLE "playthrough" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "playthrough_user_submission_idx" ON "playthrough" USING btree ("user_id","submission_id");