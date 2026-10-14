-- post/0057: In-demand needs from the landing page.
--
-- Why (owner decision, 2026-10-13): when a visitor picks a need and nobody in the Directory matches
-- it, that demand was lost unless they saved a match. The page now records each such need once per
-- visit, so the owner can see which needs go unmet and look for somebody to fill them.
--
-- What it does: creates directory_unmet_needs (need label, the job titles behind it, when). Nothing
-- about the visitor is stored. post/0056 grants the landing page login INSERT on it, and nothing else.
--
-- Safe to re-run: IF NOT EXISTS on the table, columns and index.
BEGIN;
CREATE TABLE IF NOT EXISTS directory_unmet_needs (
  id BIGSERIAL PRIMARY KEY,
  need TEXT NOT NULL,
  job_title_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_unmet_needs ADD COLUMN IF NOT EXISTS need TEXT;
ALTER TABLE IF EXISTS directory_unmet_needs ADD COLUMN IF NOT EXISTS job_title_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS directory_unmet_needs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_directory_unmet_needs_need ON directory_unmet_needs (need, created_at DESC);
COMMIT;
