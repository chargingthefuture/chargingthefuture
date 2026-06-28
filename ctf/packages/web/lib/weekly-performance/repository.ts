import { queryDb } from 'lib/db/postgres';

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

type MetricRow = {
  metric_key: string;
  metric_value: string;
  metric_unit: string;
  source_plugin: string;
};

function mapMetric(row: MetricRow) {
  return {
    metricKey: row.metric_key,
    metricValue: Number(row.metric_value),
    metricUnit: row.metric_unit,
    sourcePlugin: row.source_plugin,
  };
}

// The current week is always shown, even before any metrics have been recorded
// for it, so the dashboard renders with zero/empty values instead of a bare
// "no weeks tracked" page. When the table has no row for the current week we
// synthesize an open week from DATE_TRUNC('week', NOW()) at read time; it is
// persisted only when an admin sets it active (see selectWeek).
export async function listWeeks() {
  const result = await queryDb<WeekRow>(
    `WITH current_week AS (
       SELECT DATE_TRUNC('week', NOW())::date AS week_start_date
     ),
     combined AS (
       SELECT week_start_date, status FROM weekly_performance_weeks
       UNION
       SELECT cw.week_start_date, 'open' AS status
       FROM current_week cw
       WHERE NOT EXISTS (
         SELECT 1 FROM weekly_performance_weeks w WHERE w.week_start_date = cw.week_start_date
       )
     )
     SELECT week_start_date::text,
            (week_start_date + INTERVAL '6 days')::date::text AS week_end_date,
            status
     FROM combined
     ORDER BY week_start_date DESC
     LIMIT 52`,
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

export async function getWeekMetrics(weekStartDate: string) {
  const result = await queryDb<MetricRow>(
    `SELECT metric_key, metric_value::text, metric_unit, source_plugin
     FROM weekly_performance_metrics
     WHERE week_start_date = $1
     ORDER BY metric_key ASC`,
    [weekStartDate],
  );

  return result.rows.map(mapMetric);
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
