-- post/0035: Drop weekly_performance_metrics, the per-week aggregate store nothing reads.
--
-- Every weekly number on the Weekly Performance dashboard has been computed live from the plugins'
-- own tables on each read since 2026-06-29 (lib/weekly-performance/live-metrics.ts). This table was
-- declared for a "close the week and store the numbers" flow that never shipped: two seed scripts
-- wrote demo rows into it and no route, library or screen ever read it. Removed with the dashboard's
-- move to the shared value-event definitions (owner directive, 2026-09-21), along with its seed
-- inserts, its contract data-access entries and its schema.sql declaration.
--
-- Idempotent: IF EXISTS, so a second run finds nothing to drop.

DROP TABLE IF EXISTS weekly_performance_metrics;
