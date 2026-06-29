import { queryDb } from 'lib/db/postgres';

// Live weekly numbers.
//
// The dashboard used to stay empty until an admin "closed" the week, but nothing
// ever wrote a snapshot row, so a week with no stored metrics showed a permanent
// "metrics appear when the week closes" placeholder. Instead of waiting, we compute
// the week's engagement numbers on read, scoped to the week window, directly from the
// upstream plugin tables. The current (open) week therefore populates immediately and
// keeps moving as members use the platform; past weeks with no stored snapshot still
// report the real counts for their window.
//
// Stored snapshots still win — see getWeekMetrics, which only falls back to this when a
// week has no rows in weekly_performance_metrics. All metrics here are non-financial
// activity counts (no amounts, balances, or revenue), per the plugin's non-financial scope.

type LiveMetric = {
  metricKey: string;
  metricValue: number;
  metricUnit: string;
  sourcePlugin: string;
};

// A week window is [week_start, week_start + 7 days) — the seven days starting on the
// week's start date. Counting on the row's created_at keeps each number anchored to the
// week the activity actually happened in.
type LiveMetricSpec = {
  metricKey: string;
  metricUnit: string;
  sourcePlugin: string;
  table: string;
  // Column carrying the row's creation time; the window filter is applied to it.
  dateColumn: string;
  // true → COUNT(DISTINCT actorColumn) (e.g. distinct active members); false → COUNT(*).
  distinctColumn?: string;
  // Optional extra predicate (no user input — a fixed literal), e.g. "moderation_status = 'accepted'".
  filter?: string;
};

const SPECS: LiveMetricSpec[] = [
  {
    metricKey: 'engagement.active_members',
    metricUnit: 'members',
    sourcePlugin: 'engagement',
    table: 'login_events',
    dateColumn: 'created_at',
    distinctColumn: 'user_id',
  },
  {
    metricKey: 'engagement.questions_asked',
    metricUnit: 'questions',
    sourcePlugin: 'feed',
    table: 'feed_questions',
    dateColumn: 'created_at',
  },
  {
    metricKey: 'engagement.answers_posted',
    metricUnit: 'answers',
    sourcePlugin: 'feed',
    table: 'feed_answers',
    dateColumn: 'created_at',
  },
  {
    metricKey: 'community.posts_created',
    metricUnit: 'posts',
    sourcePlugin: 'feed',
    table: 'feed_community_posts',
    dateColumn: 'created_at',
    filter: "moderation_status = 'accepted'",
  },
  {
    metricKey: 'learning.enrollments_started',
    metricUnit: 'enrollments',
    sourcePlugin: 'level-up',
    table: 'level_up_enrollments',
    dateColumn: 'created_at',
  },
];

// Count a single metric for the window. Guards on table existence (environments built only
// from schema.sql may lack a table) and never throws — a missing table or a transient read
// error contributes 0 rather than failing the whole dashboard. Table and column names come
// only from the fixed SPECS list above, so the interpolation below carries no user input.
async function countMetric(spec: LiveMetricSpec, weekStartDate: string): Promise<number> {
  try {
    const reg = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [
      `public.${spec.table}`,
    ]);
    if (!reg.rows[0]?.reg) {
      return 0;
    }

    const countExpr = spec.distinctColumn ? `COUNT(DISTINCT ${spec.distinctColumn})` : 'COUNT(*)';
    const extraFilter = spec.filter ? `AND ${spec.filter}` : '';
    const result = await queryDb<{ total: string }>(
      `SELECT ${countExpr}::text AS total
       FROM ${spec.table}
       WHERE ${spec.dateColumn} >= $1::date
         AND ${spec.dateColumn} < ($1::date + INTERVAL '7 days')
         ${extraFilter}`,
      [weekStartDate],
    );

    return Number.parseInt(result.rows[0]?.total ?? '0', 10);
  } catch {
    return 0;
  }
}

// Compute the live engagement numbers for a week window from upstream plugin tables.
// Always returns the full metric set (a count of 0 is a real, reportable value), so the
// dashboard renders cards rather than a "nothing here yet" placeholder.
export async function computeLiveWeekMetrics(weekStartDate: string): Promise<LiveMetric[]> {
  const values = await Promise.all(SPECS.map((spec) => countMetric(spec, weekStartDate)));
  return SPECS.map((spec, index) => ({
    metricKey: spec.metricKey,
    metricValue: values[index],
    metricUnit: spec.metricUnit,
    sourcePlugin: spec.sourcePlugin,
  }));
}
