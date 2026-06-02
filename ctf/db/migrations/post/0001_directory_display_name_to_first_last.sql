-- Directory: move the single v2 `display_name` field to honest v3
-- `first_name` + `last_name` columns, then drop `display_name`.
--
-- Why this exists:
--   schema.sql now defines `directory_profiles` with `first_name` and
--   `last_name` and no `display_name`. On a fresh v3 database those columns
--   already exist and there is nothing to do. But a database cloned from v2
--   still carries the old `display_name` column (and may hold the only copy of
--   a person's name there). schema.sql is purely additive and cannot drop a
--   column, so the drop and the data carry-over live here, after the canonical
--   schema has run.
--
-- What it does, only when the old column is still present:
--   1. Carry any name that lives only in `display_name` into `first_name`
--      (where `first_name` is empty/NULL), as a best-effort single-name value.
--   2. Drop the `display_name` column.
--
-- Safe to re-run: the whole body is guarded on `display_name` still existing.
-- Once the column has been dropped, every later run is a no-op.

DO $directory_display_name_to_first_last$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'directory_profiles'
      AND column_name = 'display_name'
  ) THEN
    UPDATE directory_profiles
    SET first_name = btrim(display_name),
        updated_at = NOW()
    WHERE (first_name IS NULL OR btrim(first_name) = '')
      AND display_name IS NOT NULL
      AND btrim(display_name) <> '';

    ALTER TABLE directory_profiles DROP COLUMN display_name;
  END IF;
END
$directory_display_name_to_first_last$;
