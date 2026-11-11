-- Safe to re-run.
-- member_presence: when each signed-in member last read Today, so the board can say how many members
-- are here ("3 Avens here": read in the last 10 minutes). One row per member, touched at most once a
-- minute; counted, never listed, and never shown with a name. Account deletion removes the row.
CREATE TABLE IF NOT EXISTS member_presence (
  account_id TEXT PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS member_presence ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE IF EXISTS member_presence ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_member_presence_last_seen ON member_presence(last_seen_at);

-- today_card_saves: the stories and replays a member saved for later from Today, with the title, kind
-- and address the Saved list in Me shows, so the list still works after the card has left Today.
-- Keyed by the card id (`<source>:<id>`). Separate from today_card_marks: saving a card does not mark
-- it done and does not change how long it stays on Today. Account deletion removes the member's rows.
CREATE TABLE IF NOT EXISTS today_card_saves (
  account_id TEXT NOT NULL,
  card_id TEXT NOT NULL CHECK (char_length(card_id) BETWEEN 3 AND 241),
  kind TEXT NOT NULL CHECK (kind IN ('story', 'replay')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  href TEXT NOT NULL CHECK (char_length(href) BETWEEN 1 AND 1000),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, card_id)
);
ALTER TABLE IF EXISTS today_card_saves ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE IF EXISTS today_card_saves ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE IF EXISTS today_card_saves ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE IF EXISTS today_card_saves ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE IF EXISTS today_card_saves ADD COLUMN IF NOT EXISTS href TEXT;
ALTER TABLE IF EXISTS today_card_saves ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_today_card_saves_account ON today_card_saves(account_id, saved_at DESC);
