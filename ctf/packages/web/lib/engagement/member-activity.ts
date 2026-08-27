import { queryDb } from 'lib/db/postgres';

// What "active" means on this platform, in one place.
//
// A member is active on a day when the sign-in record holds a row for them on that day. That record
// is `login_events`, and it is the whole definition (owner decision, 2026-08-27). Every reading
// below — the dashboard's Active Members and Daily Active Members rows, and PeerProgramming's
// cohort-forming active set — counts that table and nothing else.
//
// Which plugin somebody used is not part of this and never has been, in v2 or v3: everyone reaches
// the app through Clerk, so a sign-in is a sign-in whatever they open next. `login_events` is the
// preexisting table that has always recorded it — it is in the April 2026 production schema snapshot
// with its own history — and v3 keeps writing it from the shared access gate (`recordLoginEvent`),
// once per member per UTC day.
//
// This has drifted twice, so the reasoning is worth keeping. Both times the argument for widening it
// was that the app holds a member's own dated rows — a ClickLog incident, a Commons post, a command
// trail entry — and a member with rows from Tuesday plainly used the app on Tuesday. That is true,
// and it is still not this number. Turning up is one thing and is measured here; what a member did
// once they were here is a different thing and is already measured per plugin, by that plugin's own
// rows, in its own dashboard cards. Folding the second into the first makes a headcount that moves
// when a plugin changes what it writes, cannot be compared across weeks, and quietly counts whatever
// the platform itself writes with a member id on it. One table, one meaning.
//
// So a low reading here is a fact about the sign-in record, and if that record is wrong the fix is to
// the write, not to the definition. `ctf/scripts/sql/active-members-audit.sql` is the tool for that:
// paste it into the Neon dashboard and it counts this table for a week and prints the record's own
// span, so a zero week is answerable from data — either the record covers the week and nobody signed
// in, or it does not reach that far back.
//
// The reading is guarded on the table existing, so an environment without it reports nobody rather
// than failing the dashboard. All table and column names are fixed literals — no caller input is ever
// interpolated into SQL; only the window bound travels as a bound parameter.

// The sign-in record: one row per member per UTC day, written by `recordLoginEvent`.
export const MEMBER_ACTIVITY_TABLE = 'login_events';

// Whether the sign-in record exists in this database, probed once per process — the table is created
// (or not) at deploy time and does not appear or disappear while the process runs. A failed probe is
// not cached, so a transient error cannot latch the reading to "no table".
let sourceExists: boolean | null = null;

async function hasSignInRecord(): Promise<boolean> {
  if (sourceExists !== null) {
    return sourceExists;
  }
  const result = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [
    `public.${MEMBER_ACTIVITY_TABLE}`,
  ]);
  sourceExists = Boolean(result.rows[0]?.reg);
  return sourceExists;
}

// The (member, UTC day) set for a window. One row per day a member signed in; a member who made
// several requests on one day has one row in the table already, and the DISTINCT keeps it that way
// even on a database whose once-per-day index was never built.
function memberDaysSql(windowClause: string): string {
  return `(
           SELECT DISTINCT user_id,
                  (created_at AT TIME ZONE 'UTC')::date AS activity_day
           FROM ${MEMBER_ACTIVITY_TABLE}
           WHERE ${windowClause}
             AND user_id IS NOT NULL
             AND btrim(user_id) <> ''
         )`;
}

const WEEK_WINDOW = `created_at >= $1::date AND created_at < $1::date + INTERVAL '7 days'`;

const LAST_DAYS_WINDOW = `created_at >= NOW() - make_interval(days => $1::int)`;

// Run a member-day query. A database without the sign-in record reports the empty set rather than
// throwing, so a missing table can never take the whole dashboard down.
async function queryMemberDays<T extends { [key: string]: unknown }>(
  windowClause: string,
  wrap: (memberDays: string) => string,
  parameter: string | number,
): Promise<T[]> {
  if (!(await hasSignInRecord())) {
    return [];
  }
  const result = await queryDb<T>(wrap(memberDaysSql(windowClause)), [parameter]);
  return result.rows;
}

// How many days of the week window have already started, 1–7. The live current week averages over
// the days it has actually had instead of being watered down by days that have not happened yet;
// every past week divides by the full 7. Computed in UTC so the divisor uses the same day boundary
// the member-days are bucketed on — a database session on a non-UTC timezone used to be able to
// shift this by a day.
export function elapsedDaysInWeek(weekStartDate: string, now: Date = new Date()): number {
  const weekStartMs = Date.parse(`${weekStartDate}T00:00:00Z`);
  if (Number.isNaN(weekStartMs)) {
    return 7;
  }
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const elapsed = Math.floor((todayUtcMs - weekStartMs) / 86_400_000) + 1;
  return Math.min(7, Math.max(1, elapsed));
}

// Total member-days in the week window: one per (member, day) the member signed in.
export async function countMemberDaysInWeek(weekStartDate: string): Promise<number> {
  const rows = await queryMemberDays<{ v: string | null }>(
    WEEK_WINDOW,
    (memberDays) => `SELECT COUNT(*)::text AS v FROM ${memberDays} member_days`,
    weekStartDate,
  );
  const value = rows[0]?.v;
  return value == null ? 0 : Number(value);
}

// How many different members signed in at all during the week window.
export async function countActiveMembersInWeek(weekStartDate: string): Promise<number> {
  const rows = await queryMemberDays<{ v: string | null }>(
    WEEK_WINDOW,
    (memberDays) => `SELECT COUNT(DISTINCT user_id)::text AS v FROM ${memberDays} member_days`,
    weekStartDate,
  );
  const value = rows[0]?.v;
  return value == null ? 0 : Number(value);
}

function safeDays(days: number): number {
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
}

// How many different members were active in the last N days (rolling, not a calendar week).
export async function countActiveMembersLastDays(days: number): Promise<number> {
  const rows = await queryMemberDays<{ v: string | null }>(
    LAST_DAYS_WINDOW,
    (memberDays) => `SELECT COUNT(DISTINCT user_id)::text AS v FROM ${memberDays} member_days`,
    safeDays(days),
  );
  const value = rows[0]?.v;
  return value == null ? 0 : Number(value);
}

// The members themselves, for callers that act on the set (PeerProgramming cohort formation).
export async function listActiveMemberIdsLastDays(days: number): Promise<string[]> {
  const rows = await queryMemberDays<{ user_id: string }>(
    LAST_DAYS_WINDOW,
    (memberDays) => `SELECT DISTINCT user_id FROM ${memberDays} member_days ORDER BY user_id ASC`,
    safeDays(days),
  );
  return rows.map((row) => row.user_id);
}
