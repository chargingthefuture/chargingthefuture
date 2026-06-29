import { queryDb } from 'lib/db/postgres';

// Live weekly numbers.
//
// Weekly numbers are computed on read, scoped to the selected week window, directly from the
// upstream plugin tables — the same way the V2 dashboard aggregated. There is no "close the week"
// step and no stored snapshot: the current week keeps moving as members use the platform, and any
// past week reports the real counts for its window.
//
// This set mirrors the metrics V2 captured, minus everything revenue/financial (revenue, MRR, ARR,
// CLV) — V3 is free to end users, so those have no meaning here. What remains is membership, growth,
// activity (DAU/WAU/MAU), churn, engagement, and wellbeing — all non-financial. Every query is
// guarded on table existence (environments built only from schema.sql, or the Clerk-mirrored `users`
// table, may lack a table) and never throws: a missing table or a transient error contributes 0
// rather than failing the whole dashboard. All table and column names below are fixed literals — no
// user input is interpolated into SQL.

type LiveMetric = {
  metricKey: string;
  metricValue: number;
  metricUnit: string;
  sourcePlugin: string;
};

async function tableExists(table: string): Promise<boolean> {
  const reg = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [`public.${table}`]);
  return !!reg.rows[0]?.reg;
}

// Run a single scalar query (a COUNT or an AVG aliased as `v`) guarded by table existence.
// Returns 0 on a missing table, a NULL result, or any read error.
async function guardedScalar(table: string, sql: string, weekStart: string): Promise<number> {
  try {
    if (!(await tableExists(table))) return 0;
    const result = await queryDb<{ v: string | null }>(sql, [weekStart]);
    const value = result.rows[0]?.v;
    return value == null ? 0 : Number(value);
  } catch {
    return 0;
  }
}

// The week window is [weekStart, weekStart + 7 days). Counting on each row's creation time anchors
// every number to the week the activity actually happened in.

// Distinct members seen at all up to the end of this week — a cumulative membership count that
// grows over time, so the week-over-week delta reads as roughly "members added this week".
function totalMembers(weekStart: string): Promise<number> {
  return guardedScalar(
    'login_events',
    `SELECT COUNT(DISTINCT user_id)::text AS v FROM login_events
     WHERE created_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );
}

// Members whose very first recorded activity falls inside this week (first-seen = MIN(created_at)).
function newMembers(weekStart: string): Promise<number> {
  return guardedScalar(
    'login_events',
    `SELECT COUNT(*)::text AS v FROM (
       SELECT user_id, MIN(created_at) AS first_seen FROM login_events GROUP BY user_id
     ) t
     WHERE t.first_seen >= $1::date AND t.first_seen < $1::date + INTERVAL '7 days'`,
    weekStart,
  );
}

// Distinct members active at any point during the week (weekly active members / WAU).
function weeklyActiveMembers(weekStart: string): Promise<number> {
  return guardedScalar(
    'login_events',
    `SELECT COUNT(DISTINCT user_id)::text AS v FROM login_events
     WHERE created_at >= $1::date AND created_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );
}

// Average daily active members across the week's seven days. login_events holds one row per member
// per UTC day, so the row count over the window divided by 7 is the average DAU.
function dailyActiveAverage(weekStart: string): Promise<number> {
  return guardedScalar(
    'login_events',
    `SELECT ROUND(COUNT(*)::numeric / 7)::text AS v FROM login_events
     WHERE created_at >= $1::date AND created_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );
}

// Distinct members active in the 30 days ending at this week's end (monthly active members / MAU).
function monthlyActiveMembers(weekStart: string): Promise<number> {
  return guardedScalar(
    'login_events',
    `SELECT COUNT(DISTINCT user_id)::text AS v FROM login_events
     WHERE created_at >= ($1::date + INTERVAL '7 days' - INTERVAL '30 days')
       AND created_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );
}

// Churn proxy for a free product: members active in the prior week who did not return this week.
function lapsedMembers(weekStart: string): Promise<number> {
  return guardedScalar(
    'login_events',
    `SELECT COUNT(DISTINCT p.user_id)::text AS v FROM login_events p
     WHERE p.created_at >= $1::date - INTERVAL '7 days' AND p.created_at < $1::date
       AND NOT EXISTS (
         SELECT 1 FROM login_events c
         WHERE c.user_id = p.user_id
           AND c.created_at >= $1::date AND c.created_at < $1::date + INTERVAL '7 days'
       )`,
    weekStart,
  );
}

// COUNT(*) of a table's rows whose date column falls in the week window, with an optional fixed filter.
function windowCount(table: string, dateColumn: string, filter = ''): (weekStart: string) => Promise<number> {
  const extra = filter ? `AND ${filter}` : '';
  return (weekStart: string) =>
    guardedScalar(
      table,
      `SELECT COUNT(*)::text AS v FROM ${table}
       WHERE ${dateColumn} >= $1::date AND ${dateColumn} < $1::date + INTERVAL '7 days' ${extra}`,
      weekStart,
    );
}

// Average mood (1–5) submitted during the week. Aggregate only — never an individual reading.
function moodAverage(weekStart: string): Promise<number> {
  return guardedScalar(
    'mood_submissions',
    `SELECT ROUND(AVG(mood_value)::numeric, 2)::text AS v FROM mood_submissions
     WHERE submitted_at >= $1::date AND submitted_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );
}

type MetricSpec = {
  metricKey: string;
  metricUnit: string;
  sourcePlugin: string;
  compute: (weekStart: string) => Promise<number>;
};

// Order here is the card order on the dashboard. All non-financial (no revenue/MRR/ARR/CLV).
const METRIC_SPECS: MetricSpec[] = [
  { metricKey: 'members.total', metricUnit: 'members', sourcePlugin: 'engagement', compute: totalMembers },
  { metricKey: 'members.new', metricUnit: 'members', sourcePlugin: 'engagement', compute: newMembers },
  { metricKey: 'engagement.active_members', metricUnit: 'members', sourcePlugin: 'engagement', compute: weeklyActiveMembers },
  { metricKey: 'engagement.daily_active', metricUnit: 'members', sourcePlugin: 'engagement', compute: dailyActiveAverage },
  { metricKey: 'engagement.monthly_active', metricUnit: 'members', sourcePlugin: 'engagement', compute: monthlyActiveMembers },
  { metricKey: 'retention.lapsed_members', metricUnit: 'members', sourcePlugin: 'engagement', compute: lapsedMembers },
  { metricKey: 'engagement.questions_asked', metricUnit: 'questions', sourcePlugin: 'feed', compute: windowCount('feed_questions', 'created_at') },
  { metricKey: 'engagement.answers_posted', metricUnit: 'answers', sourcePlugin: 'feed', compute: windowCount('feed_answers', 'created_at') },
  { metricKey: 'community.posts_created', metricUnit: 'posts', sourcePlugin: 'feed', compute: windowCount('feed_community_posts', 'created_at', "moderation_status = 'accepted'") },
  { metricKey: 'learning.enrollments_started', metricUnit: 'enrollments', sourcePlugin: 'level-up', compute: windowCount('level_up_enrollments', 'created_at') },
  { metricKey: 'wellbeing.mood_checkins', metricUnit: 'check-ins', sourcePlugin: 'mood', compute: windowCount('mood_submissions', 'submitted_at') },
  { metricKey: 'wellbeing.mood_average', metricUnit: '', sourcePlugin: 'mood', compute: moodAverage },
];

// Compute the live numbers for a week window from upstream plugin tables. Always returns the full
// metric set (a value of 0 is a real, reportable number), so the dashboard renders cards rather than
// a "nothing here yet" placeholder.
export async function computeLiveWeekMetrics(weekStartDate: string): Promise<LiveMetric[]> {
  const values = await Promise.all(METRIC_SPECS.map((spec) => spec.compute(weekStartDate)));
  return METRIC_SPECS.map((spec, index) => ({
    metricKey: spec.metricKey,
    metricValue: values[index],
    metricUnit: spec.metricUnit,
    sourcePlugin: spec.sourcePlugin,
  }));
}
