-- Safe to re-run.
-- today_card_marks: a member's own marks on Today cards (owner decisions, 2026-11-03), stored on the
-- account so every phone and browser agrees. `done` is the timeline dot: the card stays on Today the
-- day it was marked and leaves from the member's next day, and a story or replay brought round again
-- by its daily rotation stays off (a blog story comes back when its Fireside conversation has a newer
-- comment). `not_for_me` is the card's ••• menu: the card never comes back. Keyed by the card id
-- (`<source>:<id>`). Separate from today_card_feedback_counts, which holds anonymous daily totals.
-- Account deletion removes the member's rows.
CREATE TABLE IF NOT EXISTS today_card_marks (
  account_id TEXT NOT NULL,
  card_id TEXT NOT NULL CHECK (char_length(card_id) BETWEEN 3 AND 241),
  mark TEXT NOT NULL CHECK (mark IN ('done', 'not_for_me')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, card_id)
);
ALTER TABLE IF EXISTS today_card_marks ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE IF EXISTS today_card_marks ADD COLUMN IF NOT EXISTS card_id TEXT;
ALTER TABLE IF EXISTS today_card_marks ADD COLUMN IF NOT EXISTS mark TEXT;
ALTER TABLE IF EXISTS today_card_marks ADD COLUMN IF NOT EXISTS marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_today_card_marks_account ON today_card_marks(account_id);
