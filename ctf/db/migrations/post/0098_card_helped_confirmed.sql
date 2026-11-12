-- Safe to re-run.
-- commons_item_answers.confirmed_at: when the card's author confirmed a member's "This helped me"
-- (3.1.0 plan, Measures). Each confirmed one counts 10 action minutes toward Days won, for the
-- member who said it. NULL until confirmed; set only on kind 'helped-me'. Account deletion already
-- removes the member's answers, and the timestamp with them.
ALTER TABLE IF EXISTS commons_item_answers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_commons_item_answers_helped_confirmed
  ON commons_item_answers(confirmed_at) WHERE kind = 'helped-me' AND confirmed_at IS NOT NULL;
