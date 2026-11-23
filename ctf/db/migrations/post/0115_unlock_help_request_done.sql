-- Safe to re-run.
-- unlock_help_requests gains done_at: when an admin pressed Done on the member's help request in the
-- sign-ups panel on /admin/unlock (owner decision, 2026-11-23). NULL means not marked. A request waits,
-- and the Unlock tile on the admin landing carries its dot, until it is marked done or the member's
-- address is approved or turned down. The demo schema's copy gets the same column.
ALTER TABLE IF EXISTS unlock_help_requests ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS demo.unlock_help_requests ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ;
