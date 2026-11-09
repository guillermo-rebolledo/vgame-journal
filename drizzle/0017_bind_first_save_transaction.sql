-- Retire opportunities abandoned by the previous two-request implementation.
UPDATE "user" SET first_save_feedback = 'consumed'
WHERE first_save_feedback = 'available';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION mark_first_save_feedback() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- The account row lock selects one first insert, even across different games.
  -- Only that transaction can claim it; old application inserts also exhaust eligibility.
  UPDATE "user" SET first_save_feedback = 'insert:' || pg_current_xact_id()::text
  WHERE id = NEW.user_id AND first_save_feedback = 'eligible';
  RETURN NEW;
END;
$$;
