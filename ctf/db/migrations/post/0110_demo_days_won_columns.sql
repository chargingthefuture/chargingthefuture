-- Safe to re-run.
-- Signed-out Today reads Days won from the demo schema (its sample count, tagged Preview). The read
-- sums action minutes from four tables, and post/0098 gave commons_item_answers its confirmed_at in
-- production only, so the demo read failed and the signed-out hero showed no count. This brings the
-- demo schema's copies up to every column that read uses. Production already has them all.
ALTER TABLE IF EXISTS demo.commons_item_answers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
DO $$
BEGIN
  IF to_regclass('demo.commons_item_answers') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_commons_item_answers_helped_confirmed
      ON demo.commons_item_answers(confirmed_at) WHERE kind = 'helped-me' AND confirmed_at IS NOT NULL;
  END IF;
END $$;
ALTER TABLE IF EXISTS demo.peer_programming_goal_tasks ADD COLUMN IF NOT EXISTS kept_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS demo.peer_programming_goal_tasks ADD COLUMN IF NOT EXISTS helped BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS demo.foundation_call_sessions ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS demo.foundation_call_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
