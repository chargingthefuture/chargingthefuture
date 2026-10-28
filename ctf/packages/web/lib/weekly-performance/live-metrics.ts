import { queryDb } from 'lib/db/postgres';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
import { buildLiveGdpReport } from 'lib/shared/gdp-interface';
import {
  countActiveMembersInWeek,
  countMemberDaysInWeek,
  elapsedDaysInWeek,
} from 'lib/engagement/member-activity';

// Live weekly numbers. The dashboard's shape, in card order:
//   1. Two GOAL rows — the two numbers the entire platform is driving toward:
//      GDP Community Value Index (goal: $300B) and Workforce recruited (goal: 2,000,000).
//      Both are STATE metrics (a current total, not a windowed event count), so week-over-week
//      needs memory: each read of the current week upserts the live value into
//      weekly_performance_goal_snapshots, and past weeks report their stored snapshot.
//   2. ADOPTION rows about turnout: active members (the plain headcount for the week), signed in
//      per day (the average across the week's days), and deleted accounts.
//
// The per-plugin weekly counts (each plugin's value event, and the Directory, Mood and ClickLog
// rows) retired in 3.1.0 (owner-approved plan, Measures). Days won, retention and time to unlock on
// the adoption tab (lib/measures/) measure what members do instead. The value events themselves stay
// in lib/contributor-access/value-events.ts, which the Weavers badge and the daily exchange read.

type LiveMetric = {
  metricKey: string;
  metricValue: number;
  metricUnit: string;
  sourcePlugin: string;
};

export const GOAL_METRIC_KEYS = ['goal.gdp_value_index', 'goal.workforce_recruited'] as const;

async function tableExists(table: string): Promise<boolean> {
  const reg = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [`public.${table}`]);
  return !!reg.rows[0]?.reg;
}

// A card the dashboard could not read renders as 0, which on screen is indistinguishable from a week
// in which nothing happened — and the wrong zero is the harder one to notice, because it looks like
// an answer. One failed read must still not take the entire dashboard down, so the zero stays; what
// changes is that it is never silent. Every failure that gets flattened to 0 says what broke and
// which metric it flattened (rule 137), so "this week reads zero and I know that is wrong" is one
// look at the server log instead of a guess.
//
// A missing table is a deploy-time condition that would otherwise log on every card of every read,
// so it is reported once per table per process. A read that throws is rare, and always reported.
const reportedMissingTables = new Set<string>();

function reportMissingTable(table: string): void {
  if (reportedMissingTables.has(table)) {
    return;
  }
  reportedMissingTables.add(table);
  console.error(
    `[weekly-performance.live-metrics] this database has no ${table} table; every metric reading it reports 0 for every week until it exists`,
  );
}

// Run a single scalar query (a COUNT / SUM / AVG aliased as `v`) guarded on the existence of every
// table it touches. Returns 0 on a missing table or a NULL result. A read that fails is NOT caught
// here — it propagates to computeLiveWeekMetrics, which reports it against the metric it belongs to.
async function guardedScalar(tables: string | string[], sql: string, weekStart: string): Promise<number> {
  const needed = Array.isArray(tables) ? tables : [tables];
  for (const table of needed) {
    if (!(await tableExists(table))) {
      reportMissingTable(table);
      return 0;
    }
  }
  const result = await queryDb<{ v: string | null }>(sql, [weekStart]);
  const value = result.rows[0]?.v;
  return value == null ? 0 : Number(value);
}

// ── Adoption rows (honest non-value metrics) ──────────────────────────────────

// Two adoption readings about turnout, both built from the shared member-day set in
// lib/engagement/member-activity.ts — a (member, UTC day) pair for every day a member signed in,
// taken from the sign-in record `login_events` and nothing else (owner decision, 2026-08-27). What a
// member did once they were here is a different question, answered by action minutes
// (lib/measures/); folding it into the headcount makes a number that moves when a plugin changes
// what it writes and cannot be compared across weeks. If a reading here
// looks low, the sign-in record is what to check, not this definition — see
// ctf/scripts/sql/active-members-audit.sql, which prints the record's span next to the week's count.
// Aggregate only — never a per-member figure.

// Active members: how many different people turned up at all this week. This is the plain headcount
// the average below is easy to misread as.
const activeMembers = (weekStart: string) => countActiveMembersInWeek(weekStart);

// Daily active members: the average number of members active on a day of this week. The divisor is
// the number of days of the window that have already started (1–7), so the live current week reports
// the average of the days it has actually had instead of a figure watered down by days that have not
// happened yet; every past week divides by the full 7.
const dailyActiveMembers = async (weekStart: string) => {
  const memberDays = await countMemberDaysInWeek(weekStart);
  return Math.round((memberDays / elapsedDaysInWeek(weekStart)) * 100) / 100;
};

// Deleted accounts: how many members ended their entire account during the week — the turnout rows'
// counterpart, and the only row here that is bad when it rises.
//
// Two things are deliberately left out, because both would make this read as people leaving when
// they did not:
//   - A per-plugin "delete my data" (`scope = 'service'`). That member still has an account and is
//     still here; they cleared one plugin. Only full-account deletions (`scope = 'account'`) count.
//   - An operator-run removal. The manual `Delete Account (manual)` workflow clears duplicate and
//     demo test accounts, and writes the same account-scope row as a member's own deletion, so the
//     orchestrator marks who asked (`summary.initiatedBy`) and only the member's own choice counts.
//     Rows written before that marker existed carry none and count as the member's own, which is
//     what nearly all of them are.
//
// Counted on `completed_at`, the moment the deletion actually ran, and counted per member rather
// than per row so a repeated event for one account can never read as two people leaving.
const accountsDeleted = (weekStart: string) =>
  guardedScalar(
    'account_deletion_events',
    `SELECT COUNT(DISTINCT user_id)::text AS v FROM account_deletion_events
     WHERE scope = 'account' AND status = 'completed'
       AND COALESCE(summary->>'initiatedBy', 'member') <> 'operator'
       AND completed_at >= $1::date AND completed_at < $1::date + INTERVAL '7 days'`,
    weekStart,
  );


// ── Goal rows (state metrics with weekly snapshots) ───────────────────────────

// Current live values. GDP: the Community Value Index (an estimate, never money/price) from the
// same builder the GDP plugin serves. Workforce: recruited = the count of all Directory profiles —
// the registry definition of workforce_recruited_current_count. Every way a listing goes away is a
// hard delete (post/0033 dropped the is_active and deleted_at tombstones), so a row present is a
// member recruited; there is no liveness filter left to apply.
async function liveGdpValueIndex(): Promise<number> {
  const report = await buildLiveGdpReport();
  const row = report.metrics.find((m) => m.metricKey === 'gdp_value_index');
  return row ? row.metricValue : 0;
}

function liveWorkforceRecruited(weekStart: string): Promise<number> {
  // The trailing ($1::date IS NOT NULL) is always true — it only consumes the week parameter
  // guardedScalar binds, since this is a current-state count with no window.
  return guardedScalar(
    'directory_profiles',
    `SELECT COUNT(*)::text AS v FROM directory_profiles
     WHERE ($1::date IS NOT NULL)`,
    weekStart,
  );
}

// ISO Monday of the current UTC week — "the current week" for snapshot purposes. Exported for the
// internal goal-snapshot capture route, which records the week's goal readings on a schedule so
// goal history never depends on someone opening the dashboard that week.
export function currentWeekStart(): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return utc.toISOString().slice(0, 10);
}

// Reading the CURRENT week records the live value into that week's snapshot row (last read of the
// week wins — the row converges to the week's closing value). A past week reports its stored
// snapshot; a week that was never read while current reports 0 and renders as "not captured".
async function goalMetricForWeek(metricKey: string, weekStartDate: string, live: () => Promise<number>): Promise<number> {
  const isCurrentWeek = weekStartDate === currentWeekStart();
  if (!(await tableExists('weekly_performance_goal_snapshots'))) {
    reportMissingTable('weekly_performance_goal_snapshots');
    return isCurrentWeek ? await live() : 0;
  }

  if (!isCurrentWeek) {
    const stored = await queryDb<{ v: string | null }>(
      `SELECT metric_value::text AS v FROM weekly_performance_goal_snapshots
       WHERE metric_key = $1 AND week_start_date = $2::date`,
      [metricKey, weekStartDate],
    );
    const value = stored.rows[0]?.v;
    return value == null ? 0 : Number(value);
  }

  const value = await live();
  // The snapshot write is this week's memory for next week's comparison, not this reading. If it
  // fails, report it and still return the value we actually read — throwing here used to turn a
  // good reading into a 0 on screen because a write to a different table did not land. The
  // scheduled capture route does not go through here: it uses captureCurrentWeekGoalSnapshots,
  // which fails the request instead, so a write that did not land shows as a red run.
  try {
    await writeGoalSnapshot(metricKey, weekStartDate, value);
  } catch (error) {
    // Next week's comparison will have no prior value to read for this goal.
    reportError(error, {
      area: 'weekly-performance',
      op: 'goal_snapshot_write',
      extra: { metricKey, weekStartDate },
    });
  }
  return value;
}

async function writeGoalSnapshot(metricKey: string, weekStartDate: string, value: number): Promise<void> {
  await queryDb(
    `INSERT INTO weekly_performance_goal_snapshots (metric_key, week_start_date, metric_value, captured_at)
     VALUES ($1, $2::date, $3, NOW())
     ON CONFLICT (metric_key, week_start_date)
     DO UPDATE SET metric_value = EXCLUDED.metric_value, captured_at = NOW()`,
    [metricKey, weekStartDate, value],
  );
}

// The live reading behind each goal row, keyed the same as GOAL_METRIC_KEYS.
const GOAL_LIVE_READERS: Record<(typeof GOAL_METRIC_KEYS)[number], (weekStart: string) => Promise<number>> = {
  'goal.gdp_value_index': () => liveGdpValueIndex(),
  'goal.workforce_recruited': (weekStart) => liveWorkforceRecruited(weekStart),
};

export type GoalSnapshotCapture = {
  weekStartDate: string;
  goals: Array<{ metricKey: string; metricValue: number }>;
  // One line per goal whose reading was not stored, naming the goal and the reason. Empty on success.
  failures: string[];
};

// Record this week's goal readings for the scheduled capture route. Unlike the dashboard read, a
// reading or a write that fails is returned as a failure rather than swallowed: past weeks cannot be
// recomputed, so the schedule's safety net (the next day's run covers a missed day) only works when a
// missed day shows as a failed run.
export async function captureCurrentWeekGoalSnapshots(): Promise<GoalSnapshotCapture> {
  const weekStartDate = currentWeekStart();
  if (!(await tableExists('weekly_performance_goal_snapshots'))) {
    return {
      weekStartDate,
      goals: [],
      failures: ['this database has no weekly_performance_goal_snapshots table, so no goal reading can be stored'],
    };
  }

  const results = await Promise.all(
    GOAL_METRIC_KEYS.map(async (metricKey) => {
      try {
        const metricValue = await GOAL_LIVE_READERS[metricKey](weekStartDate);
        await writeGoalSnapshot(metricKey, weekStartDate, metricValue);
        return { metricKey, metricValue, failure: null };
      } catch (error) {
        return { metricKey, metricValue: null, failure: `${metricKey}: ${failureReason(error)}` };
      }
    }),
  );

  return {
    weekStartDate,
    goals: results
      .filter((r): r is { metricKey: (typeof GOAL_METRIC_KEYS)[number]; metricValue: number; failure: null } => r.metricValue !== null)
      .map((r) => ({ metricKey: r.metricKey, metricValue: r.metricValue })),
    failures: results.flatMap((r) => (r.failure ? [r.failure] : [])),
  };
}

type MetricSpec = {
  metricKey: string;
  metricUnit: string;
  sourcePlugin: string;
  compute: (weekStart: string) => Promise<number>;
};

// Order here is the card order on the dashboard: goals, then adoption.
const METRIC_SPECS: MetricSpec[] = [
  {
    metricKey: 'goal.gdp_value_index',
    metricUnit: 'index',
    sourcePlugin: 'gdp',
    compute: (weekStart) => goalMetricForWeek('goal.gdp_value_index', weekStart, liveGdpValueIndex),
  },
  {
    metricKey: 'goal.workforce_recruited',
    metricUnit: 'members',
    sourcePlugin: 'workforce',
    compute: (weekStart) =>
      goalMetricForWeek('goal.workforce_recruited', weekStart, () => liveWorkforceRecruited(weekStart)),
  },
  { metricKey: 'adoption.active_members', metricUnit: 'members', sourcePlugin: 'platform', compute: activeMembers },
  { metricKey: 'adoption.daily_active_members', metricUnit: 'per day', sourcePlugin: 'platform', compute: dailyActiveMembers },
  { metricKey: 'adoption.accounts_deleted', metricUnit: 'accounts', sourcePlugin: 'platform', compute: accountsDeleted },
];

// Compute one metric, reporting rather than hiding a read that failed. The 0 keeps the dashboard
// rendering when a single upstream table is unreadable; the log is what stops that 0 from passing
// as a real count.
async function computeMetric(spec: MetricSpec, weekStartDate: string): Promise<number> {
  try {
    return await spec.compute(weekStartDate);
  } catch (error) {
    console.error(
      `[weekly-performance.live-metrics] could not read ${spec.metricKey} for the week starting ${weekStartDate}; the card shows 0, which is not a real count: ${failureReason(error)}`,
    );
    return 0;
  }
}

// Compute the live numbers for a week window from upstream plugin tables. Always returns the full
// metric set (a value of 0 is a real, reportable number), so the dashboard renders cards rather than
// a "nothing here yet" placeholder.
export async function computeLiveWeekMetrics(weekStartDate: string): Promise<LiveMetric[]> {
  const values = await Promise.all(METRIC_SPECS.map((spec) => computeMetric(spec, weekStartDate)));
  return METRIC_SPECS.map((spec, index) => ({
    metricKey: spec.metricKey,
    metricValue: values[index],
    metricUnit: spec.metricUnit,
    sourcePlugin: spec.sourcePlugin,
  }));
}
