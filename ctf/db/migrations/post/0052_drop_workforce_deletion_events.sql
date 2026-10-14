-- post/0052: Drop workforce_deletion_events.
--
-- The table was the event log of the in-plugin DELETE /api/workforce/profile, which was retired on
-- 2026-10-05 because no screen called it. Its writer went with it, and nothing reads the table: the
-- central deletion orchestrator records every Workforce service delete and full-account delete in
-- account_deletion_events. The owner decided the table and the rows already in it, past deletion
-- records included, are not kept. No other table references it. Guarded with IF EXISTS so it no-ops
-- on a database that never had it, and re-runs do nothing.
DROP TABLE IF EXISTS workforce_deletion_events;
