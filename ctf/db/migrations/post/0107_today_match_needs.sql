-- Safe to re-run.
-- today_match_needs: what a member needs, for the Match card on Today (owner decision, 2026-11-16).
-- One row per member: the need keys they picked on the card (SE_MATCH_NEEDS in @ctf/shared, the
-- landing page's list) and the Skills Taxonomy job titles behind them, or the job titles of a code
-- saved on lagatos.com that they typed in. The code itself is not kept. The card's count is read live
-- from these job titles with directory_public_match_count, and People's "Fits what you need" lists
-- the same people. Account deletion removes the row.
CREATE TABLE IF NOT EXISTS today_match_needs (
  account_id TEXT PRIMARY KEY,
  need_keys TEXT[] NOT NULL DEFAULT '{}',
  job_title_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS today_match_needs ADD COLUMN IF NOT EXISTS need_keys TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS today_match_needs ADD COLUMN IF NOT EXISTS job_title_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS today_match_needs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
