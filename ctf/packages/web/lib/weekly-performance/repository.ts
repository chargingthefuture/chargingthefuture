import { queryDb } from 'lib/db/postgres';
import { PLATFORM_LAUNCH_DATE_ISO } from 'lib/platform/launch';
import { computeLiveWeekMetrics } from 'lib/weekly-performance/live-metrics';

type WeekRow = {
  week_start_date: string;
  week_end_date: string;
  status: 'open' | 'locked' | 'published';
};

function mapWeek(row: WeekRow) {
  return {
    weekStartDate: row.week_start_date,
    weekEndDate: row.week_end_date,
    status: row.status,
  };
}


// The week picker lists a continuous run of weeks, newest first, so the history never skips a
// week. We generate every week from the current week (DATE_TRUNC('week', NOW()), an ISO Monday
// start) back to the earliest of one year ago or the oldest tracked week, then union in any
// stored weeks so none is dropped and each keeps its real status. Generated weeks that have no
// stored row are shown as 'open'; their numbers are computed live per window, so an empty week
// simply reads zero rather than being missing from the list. Nothing is persisted here — a week
// gets a row only when an admin sets it active (see selectWeek).
//
// The run stops at the week containing the platform launch date (owner report, 2026-08-10): the
// platform did not exist before then, so an earlier week is not a week that read zero — it is a
// week that never happened, and listing it invites a reader to compare against a window with no
// meaning. The floor covers stored rows too, so a pre-launch row seeded by demo data cannot pull
// the list back past launch. `LEAST(current_start, ...)` keeps the generated run non-empty even if
// a clock ever reads a date before launch.
export async function listWeeks() {
  const result = await queryDb<WeekRow>(
    `WITH bounds AS (
       SELECT DATE_TRUNC('week', NOW())::date AS current_start,
              DATE_TRUNC('week', $1::date)::date AS launch_start
     ),
     span AS (
       SELECT
         b.current_start,
         LEAST(
           b.current_start,
           GREATEST(
             b.launch_start,
             LEAST(
               (b.current_start - INTERVAL '51 weeks')::date,
               COALESCE(
                 (SELECT MIN(week_start_date) FROM weekly_performance_weeks WHERE week_start_date >= b.launch_start),
                 b.current_start
               )
             )
           )
         ) AS earliest_start
       FROM bounds b
     ),
     series AS (
       SELECT generate_series(sp.current_start, sp.earliest_start, INTERVAL '-1 week')::date AS week_start_date
       FROM span sp
     ),
     combined AS (
       SELECT week_start_date, status FROM weekly_performance_weeks
       WHERE week_start_date >= (SELECT launch_start FROM bounds)
       UNION
       SELECT s.week_start_date, 'open' AS status
       FROM series s
       WHERE NOT EXISTS (
         SELECT 1 FROM weekly_performance_weeks w WHERE w.week_start_date = s.week_start_date
       )
     )
     SELECT week_start_date::text,
            (week_start_date + INTERVAL '6 days')::date::text AS week_end_date,
            status
     FROM combined
     ORDER BY week_start_date DESC
     LIMIT 260`,
    [PLATFORM_LAUNCH_DATE_ISO],
  );

  return result.rows.map(mapWeek);
}

export async function selectWeek(input: { actorId: string; weekStartDate: string }) {
  const updated = await queryDb<WeekRow>(
    `UPDATE weekly_performance_weeks
     SET selected_by_user_id = $1, selected_at = NOW(), updated_at = NOW()
     WHERE week_start_date = $2
     RETURNING week_start_date::text, (week_start_date + INTERVAL '6 days')::date::text AS week_end_date, status`,
    [input.actorId, input.weekStartDate],
  );

  if (updated.rows[0]) {
    return mapWeek(updated.rows[0]);
  }

  // The week is not tracked yet (e.g. the synthesized current week). Persist it
  // on first activation so it has a real row going forward.
  const inserted = await queryDb<WeekRow>(
    `INSERT INTO weekly_performance_weeks
       (id, week_start_date, status, selected_by_user_id, selected_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $2, 'open', $1, NOW(), NOW(), NOW())
     RETURNING week_start_date::text, (week_start_date + INTERVAL '6 days')::date::text AS week_end_date, status`,
    [input.actorId, input.weekStartDate],
  );

  if (!inserted.rows[0]) {
    throw new Error('not_found');
  }

  return mapWeek(inserted.rows[0]);
}

export async function getCurrentWeek() {
  const result = await queryDb<WeekRow>(
    `WITH current_week AS (
       SELECT DATE_TRUNC('week', NOW())::date AS week_start_date
     )
     SELECT cw.week_start_date::text,
            (cw.week_start_date + INTERVAL '6 days')::date::text AS week_end_date,
            COALESCE(w.status, 'open') AS status
     FROM current_week cw
     LEFT JOIN weekly_performance_weeks w ON w.week_start_date = cw.week_start_date
     LIMIT 1`,
  );

  return result.rows[0] ? mapWeek(result.rows[0]) : null;
}

// Returns the canonical window metadata for an arbitrary week start date, per the
// weekly-performance.week.get command contract ({weekStart, weekEnd, isCurrentWeek}). The window is
// derived from the date itself (week end = start + 6 days; isCurrentWeek compares against
// DATE_TRUNC('week', NOW())), so a week that has no row in weekly_performance_weeks yet still
// resolves; status falls back to 'open' for such synthesized weeks. The caller must validate the
// date format before calling — an unparseable value makes the $1::date cast throw.
export async function getWeekWindow(weekStartDate: string) {
  const result = await queryDb<{
    week_start_date: string;
    week_end_date: string;
    status: 'open' | 'locked' | 'published';
    is_current_week: boolean;
  }>(
    `SELECT $1::date::text AS week_start_date,
            ($1::date + INTERVAL '6 days')::date::text AS week_end_date,
            COALESCE(w.status, 'open') AS status,
            ($1::date = DATE_TRUNC('week', NOW())::date) AS is_current_week
     FROM (SELECT 1) AS anchor
     LEFT JOIN weekly_performance_weeks w ON w.week_start_date = $1::date
     LIMIT 1`,
    [weekStartDate],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    weekStart: row.week_start_date,
    weekEnd: row.week_end_date,
    status: row.status,
    isCurrentWeek: row.is_current_week,
  };
}

// Weekly numbers are always live: computed for the selected week window from upstream plugin
// tables, the same way the V2 dashboard aggregated on read. There is no "close the week" step and
// no stored snapshot to wait for — every week (the current one or any past one) reports the real
// counts for its window, and the current week keeps moving as members use the platform.
export async function getWeekMetrics(weekStartDate: string) {
  return computeLiveWeekMetrics(weekStartDate);
}

export async function getWeekComparison(input: { weekStartDate: string; compareWeekStartDate: string }) {
  const [base, compare] = await Promise.all([
    getWeekMetrics(input.weekStartDate),
    getWeekMetrics(input.compareWeekStartDate),
  ]);

  return {
    baseWeek: input.weekStartDate,
    compareWeek: input.compareWeekStartDate,
    base,
    compare,
  };
}

export async function insertWeeklyPerformanceAudit(input: {
  actorId: string;
  command: string;
  policyStatus: 'allow' | 'deny';
  reason: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  await queryDb(
    `INSERT INTO weekly_performance_audit_trail
      (id, actor_id, command, policy_status, reason, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [crypto.randomUUID(), input.actorId, input.command, input.policyStatus, input.reason, input.targetType, input.targetId, JSON.stringify(input.metadata ?? {})],
  );
}
