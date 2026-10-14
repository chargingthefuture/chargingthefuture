-- post/0046: Skills Hunt end-of-round awards.
--
-- A round is points only (owner decision, 2026-10-01). Accepting a nomination no longer sends
-- ServiceCredits; when a round closes, every scout whose score reached the round's points bar shares
-- its ServiceCredits pool in proportion to their points, sent once when an admin presses Send.
-- Adds the two award settings and the sent marker to skills_hunt_rounds, and the table that fixes
-- the split before any credits move. The old per-accept columns stay for one release because the
-- revision still running during the deploy reads them. Guarded and idempotent.
ALTER TABLE IF EXISTS skills_hunt_rounds ADD COLUMN IF NOT EXISTS award_pool_credits INTEGER NOT NULL DEFAULT 0 CHECK (award_pool_credits >= 0);
ALTER TABLE IF EXISTS skills_hunt_rounds ADD COLUMN IF NOT EXISTS award_points_bar INTEGER CHECK (award_points_bar IS NULL OR award_points_bar >= 0);
ALTER TABLE IF EXISTS skills_hunt_rounds ADD COLUMN IF NOT EXISTS awards_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS skills_hunt_round_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES skills_hunt_rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username_snapshot TEXT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  amount INTEGER NOT NULL CHECK (amount > 0),
  governance_event_id TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_round_awards_user ON skills_hunt_round_awards (user_id);
