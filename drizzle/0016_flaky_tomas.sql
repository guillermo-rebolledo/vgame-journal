ALTER TABLE "user" ADD COLUMN "first_save_feedback" text DEFAULT 'eligible' NOT NULL;--> statement-breakpoint
-- Existing accounts have already passed this opportunity, even when their Journal is empty.
UPDATE "user" SET first_save_feedback = 'consumed';
--> statement-breakpoint
CREATE FUNCTION mark_first_save_feedback() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Row locking serializes different games saved concurrently for the same account.
  UPDATE "user" SET first_save_feedback = 'available'
  WHERE id = NEW.user_id AND first_save_feedback = 'eligible';
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER journal_first_save_feedback AFTER INSERT ON journal_entry
FOR EACH ROW EXECUTE FUNCTION mark_first_save_feedback();
