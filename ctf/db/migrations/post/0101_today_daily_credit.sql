-- Safe to re-run.
-- today_daily_credit_cards: the day's credit card (owner decisions, 2026-11-11). One row per UTC day:
-- the oldest open ask on Today that day, chosen once by the first Today read of the day so it is the
-- same card for everyone. When the asker confirms it was done, the member who helped is stamped here
-- and 1 ServiceCredit is newly created for them through the governance grant path (never taken from
-- the asker; credits are not money). A helper not yet approved in Unlock is held ('held') and granted
-- on approval. A card chosen on several days still grants once, on its earliest day. Account deletion
-- removes rows where the member is the asker or the helper.
CREATE TABLE IF NOT EXISTS today_daily_credit_cards (
  day DATE PRIMARY KEY,
  card_id TEXT NOT NULL CHECK (char_length(card_id) BETWEEN 3 AND 200),
  author_user_id TEXT NOT NULL,
  chosen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  helper_user_id TEXT,
  confirmed_at TIMESTAMPTZ,
  credit_status TEXT CHECK (credit_status IN ('held', 'granted')),
  granted_at TIMESTAMPTZ,
  governance_event_id TEXT
);
ALTER TABLE IF EXISTS today_daily_credit_cards ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE IF EXISTS today_daily_credit_cards ADD COLUMN IF NOT EXISTS author_user_id TEXT;
ALTER TABLE IF EXISTS today_daily_credit_cards ADD COLUMN IF NOT EXISTS chosen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS today_daily_credit_cards ADD COLUMN IF NOT EXISTS helper_user_id TEXT;
ALTER TABLE IF EXISTS today_daily_credit_cards ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS today_daily_credit_cards ADD COLUMN IF NOT EXISTS credit_status TEXT;
ALTER TABLE IF EXISTS today_daily_credit_cards ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS today_daily_credit_cards ADD COLUMN IF NOT EXISTS governance_event_id TEXT;
CREATE INDEX IF NOT EXISTS idx_today_daily_credit_cards_card ON today_daily_credit_cards(card_id, day);
CREATE INDEX IF NOT EXISTS idx_today_daily_credit_cards_author ON today_daily_credit_cards(author_user_id);
CREATE INDEX IF NOT EXISTS idx_today_daily_credit_cards_held ON today_daily_credit_cards(helper_user_id) WHERE credit_status = 'held';
