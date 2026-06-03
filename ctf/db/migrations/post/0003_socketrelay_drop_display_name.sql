-- SocketRelay: drop the unused `display_name` column from
-- `socketrelay_user_extension`.
--
-- Why this exists:
--   The column held an optional per-user profile name, but nothing in the v3
--   product ever rendered it — SocketRelay identifies people by their Clerk
--   `@username` (built in the chat/relay routes), not a stored display name.
--   schema.sql no longer defines the column, but it is purely additive and
--   cannot drop a column that a database cloned from an earlier shape still
--   carries, so the drop lives here, after the canonical schema has run.
--
-- What it does, only when the old column is still present:
--   Drop `display_name` from `socketrelay_user_extension`.
--
-- Safe to re-run: guarded on the column still existing, so once it has been
-- dropped every later run is a no-op.

DO $socketrelay_user_extension_drop_display_name$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'socketrelay_user_extension'
      AND column_name = 'display_name'
  ) THEN
    ALTER TABLE socketrelay_user_extension DROP COLUMN display_name;
  END IF;
END
$socketrelay_user_extension_drop_display_name$;
