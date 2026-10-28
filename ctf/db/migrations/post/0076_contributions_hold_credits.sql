-- post/0076: Hold Contributions thank-you credits until Unlock approval.
--
-- 3.1.0 plan, Access: thank-you credits for a member not yet approved in Unlock are held until they
-- are. A confirmed gift card from such a member is stamped with credits_held_at and grants nothing;
-- approval runs the Contributions catch-up, which mints the credits and clears the stamp. The demo
-- schema's copy gets the column too. Safe to re-run.
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS credits_held_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS demo.contributions_submissions ADD COLUMN IF NOT EXISTS credits_held_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_contributions_submissions_held
  ON contributions_submissions(user_id) WHERE credits_held_at IS NOT NULL;
