-- Skills Hunt: rename `display_name` to `full_name` on `skills_hunt_submissions`.
--
-- Why this exists:
--   The owner relabeled the nominee's name field from "Display name" to
--   "Full name" (a design bypass was granted for the copy change). A Skills
--   Hunt nominee is a free-text full name, not a signed-up user, so the field
--   stays a single free-text value. schema.sql now defines the column as
--   `full_name`, but a database cloned from an earlier shape still carries the
--   old `display_name` column. A plain CREATE/ALTER cannot rename it, so the
--   rename lives here, after the canonical schema has run.
--
-- What it does, only when the old column is still present and the new one is
-- not: rename `display_name` to `full_name` on `skills_hunt_submissions`.
--
-- Safe to re-run: the rename is guarded on `display_name` still existing AND
-- `full_name` not yet existing, so once the column has been renamed every later
-- run is a no-op.

DO $skills_hunt_submissions_display_name_to_full_name$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skills_hunt_submissions'
      AND column_name = 'display_name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skills_hunt_submissions'
      AND column_name = 'full_name'
  ) THEN
    ALTER TABLE skills_hunt_submissions RENAME COLUMN display_name TO full_name;
  END IF;
END
$skills_hunt_submissions_display_name_to_full_name$;
