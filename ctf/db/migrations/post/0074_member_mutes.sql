-- Personal mute (3.1.0, owner-approved plan, Personal controls). A member mutes a person or a word;
-- Today leaves out cards by that person or containing that word. Nobody is told, and nothing else
-- changes: a mute is not a block. Account deletion removes a member's own mutes. Safe to re-run.
CREATE TABLE IF NOT EXISTS member_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'words')),
  target TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_mutes_unique UNIQUE (user_id, kind, target)
);
CREATE INDEX IF NOT EXISTS idx_member_mutes_user ON member_mutes(user_id);
