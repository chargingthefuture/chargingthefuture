-- Safe to re-run.
-- 3.1 Today: a member may also show the writing they lent to the Knowledge Library as Today stories.
-- The choice is per contribution, stamped with the version of the words they read, and separate from
-- the library consent (consent_version). NULL means not shown.
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS story_consent_version TEXT NULL;
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS story_consent_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_comic_contributions_story
  ON comic_contributions(reviewed_at) WHERE status = 'accepted' AND story_consent_at IS NOT NULL;
