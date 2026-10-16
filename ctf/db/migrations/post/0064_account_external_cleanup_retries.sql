-- post/0064: Failed Stream cleanups after a deletion, kept for an hourly retry.
--
-- Why (owner decision, 2026-10-16; issue #2703): a deletion removes the member's rows and then clears
-- their chat copy in Stream after the commit. When that second step failed, the failure went to error
-- tracking only and every record said the deletion had finished, so the copy stayed in Stream and
-- nobody could see which accounts were affected.
--
-- What it does: creates account_external_cleanup_retries (account id, deletion registry slug, attempt
-- count, last failure reason, first and last attempt, next attempt, and when it was given up on),
-- unique per account and slug, with an index over the rows still due.
--
-- Safe to re-run: IF NOT EXISTS on the table, every column and every index.
BEGIN;
CREATE TABLE IF NOT EXISTS account_external_cleanup_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT NOT NULL DEFAULT '',
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  given_up_at TIMESTAMPTZ
);
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS last_error TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS account_external_cleanup_retries ADD COLUMN IF NOT EXISTS given_up_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_external_cleanup_retries_user_slug
  ON account_external_cleanup_retries (user_id, slug);
CREATE INDEX IF NOT EXISTS idx_account_external_cleanup_retries_due
  ON account_external_cleanup_retries (next_attempt_at) WHERE given_up_at IS NULL;
COMMIT;
