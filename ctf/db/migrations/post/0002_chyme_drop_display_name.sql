-- Chyme: drop the redundant `display_name` column from `chyme_room_members`
-- and `chyme_messages`.
--
-- Why this exists:
--   Chyme already stores the raw `username` on both tables and the app now
--   renders the author handle as `@username` (falling back to `user-<id>` when
--   the username is null). The old `display_name` column only ever held that
--   same `@username` string, so it is redundant. schema.sql no longer defines
--   the column, but it is purely additive and cannot drop a column that a
--   database cloned from an earlier shape still carries. The drop lives here,
--   after the canonical schema has run.
--
-- What it does, only when the old column is still present:
--   Drop `display_name` from `chyme_room_members`, then from `chyme_messages`.
--
-- Safe to re-run: each drop is guarded on `display_name` still existing, so
-- once a column has been dropped every later run is a no-op.

DO $chyme_room_members_drop_display_name$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chyme_room_members'
      AND column_name = 'display_name'
  ) THEN
    ALTER TABLE chyme_room_members DROP COLUMN display_name;
  END IF;
END
$chyme_room_members_drop_display_name$;

DO $chyme_messages_drop_display_name$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chyme_messages'
      AND column_name = 'display_name'
  ) THEN
    ALTER TABLE chyme_messages DROP COLUMN display_name;
  END IF;
END
$chyme_messages_drop_display_name$;
