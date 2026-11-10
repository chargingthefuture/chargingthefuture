-- Safe to re-run.
-- today_card_windows: how long an ask or an offer stays on Today (owner decisions, 2026-11-03),
-- keyed by the card id (`<source>:<id>`, e.g. `socket-relay:123`). One row only once the poster
-- set something: a deadline chosen in + New ("By when?"), a renew (14 more days from the tap), or
-- a close from Today with its outcome ('done' or 'not_done', so needs that went unmet can be
-- counted). With no row, an ask or offer stays on Today 14 days from posting. Leaving Today never
-- closes or deletes the item; it stays open in its own part of the app. Account deletion removes
-- the poster's rows.
CREATE TABLE IF NOT EXISTS today_card_windows (
  card_id TEXT PRIMARY KEY CHECK (char_length(card_id) BETWEEN 3 AND 200),
  owner_user_id TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  shown_until TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('done', 'not_done')),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS shown_until TIMESTAMPTZ;
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS today_card_windows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_today_card_windows_owner ON today_card_windows(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_today_card_windows_outcome ON today_card_windows(outcome) WHERE outcome IS NOT NULL;
