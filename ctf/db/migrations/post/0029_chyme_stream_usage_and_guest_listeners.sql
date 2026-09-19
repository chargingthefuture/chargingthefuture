-- Chyme: a minute meter for Stream Video, a listener roster for signed-out guests.
--
-- Until now the app had no measure of its own Stream Video use: the Maker tier's 333,000
-- participant-minutes a month were a number in a rule module, and the quota-impact note that
-- turned the audio room on (2026-06-01) recorded the gap. The presence heartbeats already say who
-- is in a call and for how long, so each one now credits the seconds since the last into a daily
-- row per surface. The Chyme admin screen reads it; the policy that pauses guest listening and
-- Back Channel calls near the ceiling reads it too.
--
-- Signed-out listeners had no row anywhere, so there was no way to cap how many listen at once,
-- and every page load minted a fresh Stream user. The listener page now holds one random guest id
-- in an httpOnly cookie and heartbeats like a member; this table is the roster that count reads.
-- No personal data: a guest id is a random value and nothing else.

CREATE TABLE IF NOT EXISTS chyme_guest_listeners (
  guest_id TEXT PRIMARY KEY,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS chyme_guest_listeners ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS chyme_guest_listeners ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_chyme_guest_listeners_last_seen ON chyme_guest_listeners(last_seen_at);

COMMENT ON TABLE chyme_guest_listeners IS
  'Signed-out listeners in the public Chyme room, one row per browser (random guest id from an httpOnly cookie). A guest counts only while last_seen_at is inside the presence window. No personal data.';

CREATE TABLE IF NOT EXISTS stream_video_usage_daily (
  usage_date DATE NOT NULL,
  surface TEXT NOT NULL,
  participant_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usage_date, surface)
);
ALTER TABLE IF EXISTS stream_video_usage_daily ADD COLUMN IF NOT EXISTS participant_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS stream_video_usage_daily ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON TABLE stream_video_usage_daily IS
  'Stream Video participant-seconds per UTC day per surface, credited from presence heartbeats. The app''s own estimate of the participant-minutes meter; the Stream dashboard is the bill of record.';
