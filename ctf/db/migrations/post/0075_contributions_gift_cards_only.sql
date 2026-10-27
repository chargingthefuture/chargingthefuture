-- post/0075: Contributions takes Amazon gift cards only, all year.
--
-- 3.1.0 plan (Contributions): no drives, goals, progress or banner, and no Quora comment or GitHub
-- star claims. The member types the gift card code in the app; it is stored encrypted and erased
-- when the claim is confirmed or rejected. Signal is no longer how a code arrives, so the member's
-- Signal contact and the Signal instructions go. The thank-you credit cap now runs over the last
-- 365 days instead of per drive, so its column becomes per_user_year_credit_cap, keeping its value.
-- The code, routes and screens that used the dropped tables and columns are removed in the same
-- change. The demo schema's copies go too.
-- Safe to re-run.

-- Quora and GitHub claims still waiting are closed, with the reason, before their columns go.
UPDATE contributions_submissions
   SET status = 'rejected', reviewed_at = NOW(), updated_at = NOW(),
       review_note = 'Contributions now takes Amazon gift cards only, so this claim was closed without review.'
 WHERE status = 'pending' AND kind IN ('quora_comment', 'github_star');

ALTER TABLE IF EXISTS contributions_submissions DROP CONSTRAINT IF EXISTS contributions_submissions_gift_card_signal_check;
ALTER TABLE IF EXISTS contributions_submissions DROP CONSTRAINT IF EXISTS contributions_submissions_cycle_id_fkey;
ALTER TABLE IF EXISTS contributions_submissions DROP COLUMN IF EXISTS signal_contact;
ALTER TABLE IF EXISTS contributions_submissions DROP COLUMN IF EXISTS quora_post_url;
ALTER TABLE IF EXISTS contributions_submissions DROP COLUMN IF EXISTS github_profile_url;
ALTER TABLE IF EXISTS contributions_submissions DROP COLUMN IF EXISTS cycle_id;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS gift_card_code_encrypted TEXT;
DROP TABLE IF EXISTS contributions_cycles;
DROP TABLE IF EXISTS contributions_banner_state;
ALTER TABLE IF EXISTS contributions_runtime_config DROP CONSTRAINT IF EXISTS contributions_runtime_config_positive_check;
ALTER TABLE IF EXISTS contributions_runtime_config DROP COLUMN IF EXISTS non_monetary_unit_value_usd;
ALTER TABLE IF EXISTS contributions_runtime_config DROP COLUMN IF EXISTS banner_snooze_months;
ALTER TABLE IF EXISTS contributions_runtime_config DROP COLUMN IF EXISTS banner_enabled;
ALTER TABLE IF EXISTS contributions_runtime_config DROP COLUMN IF EXISTS signal_instructions;
-- schema.sql may already have added the new column with its default, so the kept value is copied
-- across and the old column dropped, rather than renamed.
DO $rename_cap$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'contributions_runtime_config'
       AND column_name = 'per_user_cycle_credit_cap'
  ) THEN
    ALTER TABLE contributions_runtime_config
      ADD COLUMN IF NOT EXISTS per_user_year_credit_cap NUMERIC NOT NULL DEFAULT 300;
    UPDATE contributions_runtime_config SET per_user_year_credit_cap = per_user_cycle_credit_cap;
    ALTER TABLE contributions_runtime_config DROP COLUMN per_user_cycle_credit_cap;
  END IF;
END
$rename_cap$;
ALTER TABLE IF EXISTS contributions_runtime_config
  ADD CONSTRAINT contributions_runtime_config_positive_check
  CHECK (credits_per_usd > 0 AND per_user_year_credit_cap > 0);

ALTER TABLE IF EXISTS demo.contributions_submissions DROP CONSTRAINT IF EXISTS contributions_submissions_gift_card_signal_check;
ALTER TABLE IF EXISTS demo.contributions_submissions DROP CONSTRAINT IF EXISTS contributions_submissions_cycle_id_fkey;
ALTER TABLE IF EXISTS demo.contributions_submissions DROP COLUMN IF EXISTS signal_contact;
ALTER TABLE IF EXISTS demo.contributions_submissions DROP COLUMN IF EXISTS quora_post_url;
ALTER TABLE IF EXISTS demo.contributions_submissions DROP COLUMN IF EXISTS github_profile_url;
ALTER TABLE IF EXISTS demo.contributions_submissions DROP COLUMN IF EXISTS cycle_id;
ALTER TABLE IF EXISTS demo.contributions_submissions ADD COLUMN IF NOT EXISTS gift_card_code_encrypted TEXT;
DROP TABLE IF EXISTS demo.contributions_cycles;
DROP TABLE IF EXISTS demo.contributions_banner_state;
ALTER TABLE IF EXISTS demo.contributions_runtime_config DROP CONSTRAINT IF EXISTS contributions_runtime_config_positive_check;
ALTER TABLE IF EXISTS demo.contributions_runtime_config DROP COLUMN IF EXISTS non_monetary_unit_value_usd;
ALTER TABLE IF EXISTS demo.contributions_runtime_config DROP COLUMN IF EXISTS banner_snooze_months;
ALTER TABLE IF EXISTS demo.contributions_runtime_config DROP COLUMN IF EXISTS banner_enabled;
ALTER TABLE IF EXISTS demo.contributions_runtime_config DROP COLUMN IF EXISTS signal_instructions;
DO $rename_demo_cap$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'demo' AND table_name = 'contributions_runtime_config'
       AND column_name = 'per_user_cycle_credit_cap'
  ) THEN
    ALTER TABLE demo.contributions_runtime_config
      ADD COLUMN IF NOT EXISTS per_user_year_credit_cap NUMERIC NOT NULL DEFAULT 300;
    UPDATE demo.contributions_runtime_config SET per_user_year_credit_cap = per_user_cycle_credit_cap;
    ALTER TABLE demo.contributions_runtime_config DROP COLUMN per_user_cycle_credit_cap;
  END IF;
END
$rename_demo_cap$;
