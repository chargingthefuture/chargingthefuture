-- schema.sql carries the same CREATE TABLE. This migration makes the table appear in production on
-- the same run, alongside the other post migrations.
-- Comic (@comic assistant) runtime settings an admin can change from the app. One row.
--
-- unlock_help_without_review: when true, an @comic answer to an Unlock question from a member not yet
-- approved is sent straight to them instead of waiting in the review queue (owner decision,
-- 2026-09-26). Every other @comic answer is held for review regardless. Switched from the Unlock help
-- log (/admin/comic/unlock-help). No row means the default, true; turning it off writes the row.
CREATE TABLE IF NOT EXISTS comic_runtime_config (
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  unlock_help_without_review BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_user_id TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS comic_runtime_config ADD COLUMN IF NOT EXISTS unlock_help_without_review BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS comic_runtime_config ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT NULL;
ALTER TABLE IF EXISTS comic_runtime_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
