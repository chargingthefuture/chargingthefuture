-- post/0078: 3.1 is the default (owner decision, 2026-10-28, the launch).
--
-- New rows default to 3.1, and every member saved on 3.0 moves to 3.1. A stored 3.0 could not say
-- whether somebody chose it or only saved a theme while 3.0 was the default, so the launch moves
-- all of them; anybody can go back to 3.0 in Settings. Production and the demo schema. Safe to
-- re-run, though a re-run would move back anybody who chose 3.0 again since.

ALTER TABLE IF EXISTS user_ui_preferences ALTER COLUMN interface_version SET DEFAULT '3.1';
UPDATE user_ui_preferences SET interface_version = '3.1', updated_at = NOW() WHERE interface_version = '3.0';

ALTER TABLE IF EXISTS demo.user_ui_preferences ALTER COLUMN interface_version SET DEFAULT '3.1';
DO $$
BEGIN
  IF to_regclass('demo.user_ui_preferences') IS NOT NULL THEN
    UPDATE demo.user_ui_preferences SET interface_version = '3.1', updated_at = NOW() WHERE interface_version = '3.0';
  END IF;
END $$;
