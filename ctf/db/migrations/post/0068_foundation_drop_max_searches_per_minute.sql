-- Drop max_searches_per_minute from the Foundation capacity policy and its event log.
--
-- Why (owner decision, 2026-10-17; issue #2962): the admin form saved it and nothing read it, since
-- provider search has no per-minute limit. The form field is removed in the same change. The demo
-- schema's copies go too. Safe to re-run: every statement is guarded by IF EXISTS.
ALTER TABLE IF EXISTS foundation_capacity_policies DROP COLUMN IF EXISTS max_searches_per_minute;
ALTER TABLE IF EXISTS foundation_capacity_policy_events DROP COLUMN IF EXISTS max_searches_per_minute;

ALTER TABLE IF EXISTS demo.foundation_capacity_policies DROP COLUMN IF EXISTS max_searches_per_minute;
ALTER TABLE IF EXISTS demo.foundation_capacity_policy_events DROP COLUMN IF EXISTS max_searches_per_minute;
