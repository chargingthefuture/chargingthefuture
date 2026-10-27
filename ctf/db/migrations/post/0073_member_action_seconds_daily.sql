-- Action minutes for Days won and retention (3.1.0, owner-approved plan, Measures).
--
-- One row per member per day per source ('chyme-room', 'back-channel'): seconds connected, added on
-- each presence heartbeat the same way the room's minute meter is. Foundation calls and confirmed
-- PeerProgramming tasks are read from their own tables, so they are not copied here. Account
-- deletion removes a member's rows. Safe to re-run.
CREATE TABLE IF NOT EXISTS member_action_seconds_daily (
  user_id TEXT NOT NULL,
  usage_date DATE NOT NULL,
  source TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date, source)
);
CREATE INDEX IF NOT EXISTS idx_member_action_seconds_daily_date ON member_action_seconds_daily(usage_date);
