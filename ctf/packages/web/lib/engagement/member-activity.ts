import { queryDb } from 'lib/db/postgres';

// What "active" means on this platform, in one place.
//
// A member-day is a (member, UTC day) pair on which that member did something in the app. Until now
// the only source of member-days was `login_events`, written from the plugin access gate by a
// fire-and-forget insert. That made every active-member reading depend on one write landing: when it
// did not — a database missing the once-per-day unique index the insert named by expression, a pool
// error, a request torn down before the write completed — the member disappeared from the number
// even though the app was holding that member's own rows, timestamped, from the same day. A member
// who logged a ClickLog incident on Tuesday was active on Tuesday; the reading should not need a
// separate sign-in row to know that.
//
// So the reading is taken from the member's own rows as well as the sign-in record. Every source
// below is first-party, member-attributed, and dated by the member's own action, so a row in any of
// them is proof the member used the app that day. Sources are guarded on existence, so a database
// that does not have one of these tables contributes nothing rather than failing the whole query.
// All table and column names are fixed literals — no caller input is ever interpolated into SQL;
// only the window bound travels as a bound parameter.
//
// Deliberately NOT sources: rows whose timestamp is written by the counterparty or by an admin
// rather than by the member (a trip's completion, a nomination's review, a disbursement). Those say
// something happened to the member, not that the member turned up.

export type MemberActivitySource = {
  table: string;
  userColumn: string;
  dateColumn: string;
};

export const MEMBER_ACTIVITY_SOURCES: readonly MemberActivitySource[] = [
  // Any authenticated request through the plugin access gate, deduplicated to one row per member
  // per UTC day. Still the broadest source — it sees a member who only reads.
  { table: 'login_events', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'click_log_incidents', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'mood_submissions', userColumn: 'user_id', dateColumn: 'submitted_at' },
  { table: 'feed_community_posts', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'feed_community_replies', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'feed_community_post_reactions', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'peer_programming_messages', userColumn: 'author_user_id', dateColumn: 'created_at' },
];

async function tableExists(table: string): Promise<boolean> {
  const result = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [`public.${table}`]);
  return Boolean(result.rows[0]?.reg);
}

async function availableSources(): Promise<MemberActivitySource[]> {
  const checked = await Promise.all(
    MEMBER_ACTIVITY_SOURCES.map(async (source) => ((await tableExists(source.table)) ? source : null)),
  );
  return checked.filter((source): source is MemberActivitySource => source !== null);
}

// Builds the (member, UTC day) set for a window. `windowClause` receives the source's own date
// column so each source is windowed on the timestamp its own rows carry. UNION rather than UNION
// ALL, so a member who appears in several sources on one day is still one member-day.
function memberDaysSql(sources: MemberActivitySource[], windowClause: (dateColumn: string) => string): string {
  return sources
    .map(
      (source) =>
        `SELECT ${source.userColumn} AS user_id,
                (${source.dateColumn} AT TIME ZONE 'UTC')::date AS activity_day
         FROM ${source.table}
         WHERE ${windowClause(source.dateColumn)}
           AND ${source.userColumn} IS NOT NULL
           AND btrim(${source.userColumn}) <> ''`,
    )
    .join('\n         UNION\n');
}

const weekWindow = (dateColumn: string) =>
  `${dateColumn} >= $1::date AND ${dateColumn} < $1::date + INTERVAL '7 days'`;

const lastDaysWindow = (dateColumn: string) => `${dateColumn} >= NOW() - make_interval(days => $1::int)`;

// Run a member-day query over every available source. A database with none of these tables (or a
// read that fails) reports the empty set rather than throwing, so one missing table can never take
// the whole dashboard down.
async function queryMemberDays<T extends { [key: string]: unknown }>(
  windowClause: (dateColumn: string) => string,
  wrap: (memberDays: string) => string,
  parameter: string | number,
): Promise<T[]> {
  const sources = await availableSources();
  if (sources.length === 0) {
    return [];
  }
  const result = await queryDb<T>(wrap(`(\n${memberDaysSql(sources, windowClause)}\n         )`), [parameter]);
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

// Total member-days in the week window: one per (member, day) the member did something.
export async function countMemberDaysInWeek(weekStartDate: string): Promise<number> {
  const rows = await queryMemberDays<{ v: string | null }>(
    weekWindow,
    (memberDays) => `SELECT COUNT(*)::text AS v FROM ${memberDays} member_days`,
    weekStartDate,
  );
  const value = rows[0]?.v;
  return value == null ? 0 : Number(value);
}

// How many different members turned up at all during the week window.
export async function countActiveMembersInWeek(weekStartDate: string): Promise<number> {
  const rows = await queryMemberDays<{ v: string | null }>(
    weekWindow,
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
    lastDaysWindow,
    (memberDays) => `SELECT COUNT(DISTINCT user_id)::text AS v FROM ${memberDays} member_days`,
    safeDays(days),
  );
  const value = rows[0]?.v;
  return value == null ? 0 : Number(value);
}

// The members themselves, for callers that act on the set (PeerProgramming cohort formation).
export async function listActiveMemberIdsLastDays(days: number): Promise<string[]> {
  const rows = await queryMemberDays<{ user_id: string }>(
    lastDaysWindow,
    (memberDays) => `SELECT DISTINCT user_id FROM ${memberDays} member_days ORDER BY user_id ASC`,
    safeDays(days),
  );
  return rows.map((row) => row.user_id);
}

// Per-source member and member-day counts for one week — what the audit script prints so an
// operator can see which sources a week's reading came from, and spot a source that has gone quiet
// because its writes are failing. Aggregate counts only; no member is ever named.
export async function describeWeekActivitySources(
  weekStartDate: string,
): Promise<{ table: string; present: boolean; memberDays: number; members: number }[]> {
  const rows = await Promise.all(
    MEMBER_ACTIVITY_SOURCES.map(async (source) => {
      if (!(await tableExists(source.table))) {
        return { table: source.table, present: false, memberDays: 0, members: 0 };
      }
      const counts = await queryDb<{ member_days: string; members: string }>(
        `SELECT COUNT(*)::text AS member_days, COUNT(DISTINCT user_id)::text AS members
         FROM (
           SELECT DISTINCT ${source.userColumn} AS user_id,
                  (${source.dateColumn} AT TIME ZONE 'UTC')::date AS activity_day
           FROM ${source.table}
           WHERE ${weekWindow(source.dateColumn)}
             AND ${source.userColumn} IS NOT NULL
             AND btrim(${source.userColumn}) <> ''
         ) source_days`,
        [weekStartDate],
      );
      return {
        table: source.table,
        present: true,
        memberDays: Number(counts.rows[0]?.member_days ?? 0),
        members: Number(counts.rows[0]?.members ?? 0),
      };
    }),
  );
  return rows;
}
