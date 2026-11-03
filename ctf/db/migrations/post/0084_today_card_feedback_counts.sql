-- Safe to re-run.
-- today_card_feedback_counts: how many times a day members marked a Today card done or picked Not
-- for me, by the card's source and kind. A total only: no account id and nothing about who tapped,
-- so there is nothing in it to delete when an account is deleted. Read by the Adoption admin
-- screen's "What members finish and pass on" section.
CREATE TABLE IF NOT EXISTS today_card_feedback_counts (
  day DATE NOT NULL,
  source TEXT NOT NULL CHECK (char_length(source) BETWEEN 1 AND 40),
  kind TEXT NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 20),
  signal TEXT NOT NULL CHECK (signal IN ('done', 'not_for_me')),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, source, kind, signal)
);
ALTER TABLE IF EXISTS today_card_feedback_counts ADD COLUMN IF NOT EXISTS day DATE;
ALTER TABLE IF EXISTS today_card_feedback_counts ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE IF EXISTS today_card_feedback_counts ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE IF EXISTS today_card_feedback_counts ADD COLUMN IF NOT EXISTS signal TEXT;
ALTER TABLE IF EXISTS today_card_feedback_counts ADD COLUMN IF NOT EXISTS count INTEGER NOT NULL DEFAULT 0;
