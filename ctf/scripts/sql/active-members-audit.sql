-- Active-member audit, as SQL to paste into the Neon dashboard.
--
-- Same questions as ctf/scripts/audit-active-members.mjs, for when there is no terminal to run it
-- from. Read-only: these are SELECTs and nothing here writes, locks, or deletes.
--
-- Run against the `public` schema. Demo mode reads a parallel `demo` schema, so a query run there
-- reports seeded synthetic data rather than real members — query 3 tells the two apart.
--
-- A member is active on a day when the sign-in record (`login_events`) holds a row for them that
-- day. That is the whole definition of the dashboard's Active Members and Daily Active Members
-- rows, so query 2 below returns the dashboard's own numbers.

-- 1. What the sign-in record holds and how far back it reaches. `total_members` skips blank ids so
--    it matches the member counts in query 2; `total_rows` is the raw row count.
--    If `first_row` predates a week that the dashboard reports as zero, the rows are there and the
--    dashboard is wrong. If `first_row` is later than that week, the record does not reach it.
SELECT COUNT(*)                                                      AS total_rows,
       COUNT(DISTINCT user_id) FILTER (WHERE btrim(user_id) <> '')   AS total_members,
       MIN(created_at)                                               AS first_row,
       MAX(created_at)                                               AS last_row
FROM public.login_events;

-- 2. Active Members and Daily Active Members per week, from the launch week onward.
--    Every week is listed, so a week with no rows shows as an explicit 0 rather than going missing.
--    The dashboard divides the CURRENT week by the days it has had so far; this divides every week
--    by 7, so only the newest row's daily average differs from the screen.
WITH weeks AS (
  -- Both bounds are plain timestamps in UTC, so the Monday boundaries line up with the UTC day the
  -- rows are bucketed on rather than with the database session's timezone.
  SELECT generate_series(
           DATE_TRUNC('week', TIMESTAMP '2026-06-12 00:00:00'),
           DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC'),
           INTERVAL '1 week'
         )::date AS week_start
),
member_days AS (
  SELECT DISTINCT
         user_id,
         (created_at AT TIME ZONE 'UTC')::date AS activity_day
  FROM public.login_events
  WHERE user_id IS NOT NULL
    AND btrim(user_id) <> ''
)
SELECT w.week_start,
       COUNT(DISTINCT d.user_id)                        AS active_members,
       COUNT(d.user_id)                                 AS member_days,
       ROUND(COUNT(d.user_id)::numeric / 7, 2)          AS daily_active_members
FROM weeks w
LEFT JOIN member_days d
  ON d.activity_day >= w.week_start
 AND d.activity_day <  w.week_start + 7
GROUP BY w.week_start
ORDER BY w.week_start;

-- 3. Day by day across the launch week, for when query 2 reports a zero there.
--    An empty result means the record holds nothing for those days.
SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
       COUNT(DISTINCT user_id)               AS members,
       COUNT(*)                              AS rows_written
FROM public.login_events
WHERE (created_at AT TIME ZONE 'UTC')::date >= DATE '2026-06-08'
  AND (created_at AT TIME ZONE 'UTC')::date <  DATE '2026-06-15'
  AND user_id IS NOT NULL
  AND btrim(user_id) <> ''
GROUP BY 1
ORDER BY 1;

-- 4. Is a `demo` copy of the record in play? Demo mode is a per-member allowlist that routes reads
--    to a parallel `demo` schema holding seeded synthetic data, so a demo-mode session sees a
--    different table than query 2 just counted. NULL here means there is no demo schema, which is
--    the normal case and rules this out. If it returns a name, run the follow-up below and compare
--    it with query 1 — a much smaller count, or a recent first row, means the dashboard reading you
--    are looking at came from the seeded copy.
SELECT to_regclass('demo.login_events') AS demo_sign_in_record;

-- Follow-up for query 4, only if it returned a name rather than NULL:
--   SELECT COUNT(*) AS demo_rows, MIN(created_at) AS demo_first_row FROM demo.login_events;
