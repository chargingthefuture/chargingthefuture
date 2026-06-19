-- post/0007: Drop the per-plugin workforce announcements table.
--
-- Announcements are now posted in one place — the Feed (feed-announcements
-- plugin), which can target any plugin. Workforce no longer keeps its own
-- announcements, so the dedicated table is removed. Guarded with IF EXISTS so
-- it no-ops on a fresh database that never had the table, and idempotent
-- (re-running changes nothing once the table is gone).
DROP TABLE IF EXISTS workforce_announcements;
