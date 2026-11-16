-- Safe to re-run.
-- Visitors may read a member's replies on members' stories once that member agrees in Settings
-- (owner decision, 2026-11-16). user_ui_preferences gains the version of the words agreed to and the
-- time agreed; both NULL means not agreed. Account deletion already removes the row. The demo
-- schema's copy gets the same columns, so the setting works for demo accounts too.
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS story_replies_visitors_version TEXT;
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS story_replies_visitors_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS demo.user_ui_preferences ADD COLUMN IF NOT EXISTS story_replies_visitors_version TEXT;
ALTER TABLE IF EXISTS demo.user_ui_preferences ADD COLUMN IF NOT EXISTS story_replies_visitors_at TIMESTAMPTZ;
