BEGIN;

ALTER TABLE lighthouse_profiles
  ADD COLUMN IF NOT EXISTS desired_move_in_date DATE;

COMMIT;
