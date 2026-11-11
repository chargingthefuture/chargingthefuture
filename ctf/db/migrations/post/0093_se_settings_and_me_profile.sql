-- Safe to re-run.
-- 3.1 Settings (approved board "Settings" and "Theme", 2026-11-02): the member's colors, text size,
-- higher contrast, easier-to-read font and emoji rain, saved on the account so every phone and
-- browser agrees. se_theme_color and se_theme_mode are NULL until the member picks; the app then
-- draws the default colors.
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS se_theme_color TEXT;
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS se_theme_mode TEXT;
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS text_size TEXT NOT NULL DEFAULT 'default';
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS high_contrast BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS readable_font BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS emoji_rain BOOLEAN NOT NULL DEFAULT FALSE;
DO $user_ui_preferences_se_checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ui_preferences_se_theme_color_check' AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE user_ui_preferences ADD CONSTRAINT user_ui_preferences_se_theme_color_check
      CHECK (se_theme_color IS NULL OR se_theme_color IN ('forest', 'burgundy', 'coral', 'teal-purple'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ui_preferences_se_theme_mode_check' AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE user_ui_preferences ADD CONSTRAINT user_ui_preferences_se_theme_mode_check
      CHECK (se_theme_mode IS NULL OR se_theme_mode IN ('dark', 'light'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ui_preferences_text_size_check' AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE user_ui_preferences ADD CONSTRAINT user_ui_preferences_text_size_check
      CHECK (text_size IN ('default', 'large', 'larger'));
  END IF;
END
$user_ui_preferences_se_checks$;

-- 3.1 Settings → Notifications (approved board "Settings", 2026-11-02): three rows, "Replies and talk
-- requests", "Rooms starting" and "Everything else", and quiet hours. A member on 3.1 gets device push
-- by these rows; a member on 3.0 by the three categories above. Quiet hours hold every device push
-- (the in-app list still gets the row) between quiet_start_minute and quiet_end_minute, minutes after
-- midnight in quiet_time_zone; NULL means no quiet hours. When the rows are first added, each starts
-- from the categories the member already had on, so nobody's alerts stop on the day this ships.
DO $notification_preferences_se_rows$
BEGIN
  IF to_regclass('notification_preferences') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'notification_preferences' AND column_name = 'push_replies'
  ) THEN
    ALTER TABLE notification_preferences ADD COLUMN push_replies BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_rooms BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS push_other BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE notification_preferences
      SET push_replies = push_community, push_rooms = push_community, push_other = (push_safety OR push_activity OR push_community);
  END IF;
END
$notification_preferences_se_rows$;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS push_replies BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS push_rooms BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS push_other BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS quiet_start_minute SMALLINT CHECK (quiet_start_minute BETWEEN 0 AND 1439);
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS quiet_end_minute SMALLINT CHECK (quiet_end_minute BETWEEN 0 AND 1439);
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS quiet_time_zone TEXT CHECK (char_length(quiet_time_zone) <= 64);

-- member_profile_prompts: the three short lines on a member's own Me screen (approved board "Me",
-- 2026-11-02): "I can help with", "I need" and "Ask me about". One row per account, each line
-- optional (empty when not written) and at most 140 characters. Shown only on the member's own Me
-- screen. Account deletion removes the row.
CREATE TABLE IF NOT EXISTS member_profile_prompts (
  account_id TEXT PRIMARY KEY,
  can_help_with TEXT NOT NULL DEFAULT '' CHECK (char_length(can_help_with) <= 140),
  needs TEXT NOT NULL DEFAULT '' CHECK (char_length(needs) <= 140),
  ask_me_about TEXT NOT NULL DEFAULT '' CHECK (char_length(ask_me_about) <= 140),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS member_profile_prompts ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE IF EXISTS member_profile_prompts ADD COLUMN IF NOT EXISTS can_help_with TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_profile_prompts ADD COLUMN IF NOT EXISTS needs TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_profile_prompts ADD COLUMN IF NOT EXISTS ask_me_about TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_profile_prompts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
