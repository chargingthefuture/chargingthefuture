-- Safe to re-run.
-- question_matching_settings: whether a member is matched in 21 Questions. No row means on. Off
-- leaves their answers out of every match, theirs and everyone else's, from the next read; the
-- answers themselves are kept. Answering never changes it; only the member's own toggle does.
-- schema.sql creates the same table; this file brings an existing database up to date without
-- waiting on a schema run, as 0079 did for the other 21 Questions tables.
CREATE TABLE IF NOT EXISTS question_matching_settings (
  user_id TEXT PRIMARY KEY,
  matching_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS question_matching_settings ADD COLUMN IF NOT EXISTS matching_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS question_matching_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
