-- Safe to re-run.
-- Emoji rain (3.1 plan, Look): the Days won total this account last saw on Today. Today rains when
-- the switch is on and the total is higher than this; NULL until Today first records one.
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS days_won_seen INTEGER;
DO $user_ui_preferences_days_won_seen_check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ui_preferences_days_won_seen_check' AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE user_ui_preferences ADD CONSTRAINT user_ui_preferences_days_won_seen_check
      CHECK (days_won_seen IS NULL OR days_won_seen >= 0);
  END IF;
END
$user_ui_preferences_days_won_seen_check$;
