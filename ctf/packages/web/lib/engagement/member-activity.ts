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
// The same reasoning is what makes the earliest weeks readable. `login_events` got its writer on
// 2026-06-16, four days after the platform launched on 2026-06-12, so nothing at all was written to
// it during the first week the dashboard offers (Jun 8–14) or the first days of the second. Someone
// who used the app every day of that week still read as zero people, because the only broad source
// did not exist yet and the content tables below are narrow: an owner reviewing submissions and
// reading dashboards logs no incident, posts nothing, and checks in nowhere. The command trails
// close that hole. Every plugin writes one row per command a member runs — reads included — with
// that member as the actor and the member's own request time on it, and they have been written since
// each plugin shipped. They are the record of a member turning up that the app already had.
//
// So the reading is taken from the member's own rows as well as the sign-in record. Every source
// below is first-party, member-attributed, and dated by the member's own action, so a row in any of
// them is proof the member used the app that day. Sources are guarded on existence, so a database
// that does not have one of these tables contributes nothing rather than failing the whole query.
// All table and column names are fixed literals — no caller input is ever interpolated into SQL;
// only the window bound and the excluded-actor list travel as bound parameters.
//
// Deliberately NOT sources: rows whose timestamp is written by the counterparty or by an admin
// rather than by the member (a trip's completion, a nomination's review, a disbursement), and rows
// the platform scores about a member rather than records the member doing (trust_transport risk
// signals). Those say something happened to the member, not that the member turned up.

export type MemberActivitySource = {
  table: string;
  userColumn: string;
  dateColumn: string;
};

export const MEMBER_ACTIVITY_SOURCES: readonly MemberActivitySource[] = [
  // Any authenticated request through the plugin access gate, deduplicated to one row per member
  // per UTC day. The broadest single source — it sees a member who only reads — but only from
  // 2026-06-16, when it got its writer.
  { table: 'login_events', userColumn: 'user_id', dateColumn: 'created_at' },

  // Things the member made or wrote, dated by the writing.
  { table: 'click_log_incidents', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'mood_submissions', userColumn: 'user_id', dateColumn: 'submitted_at' },
  { table: 'feed_community_posts', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'feed_community_replies', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'feed_community_post_reactions', userColumn: 'user_id', dateColumn: 'created_at' },
  { table: 'peer_programming_messages', userColumn: 'author_user_id', dateColumn: 'created_at' },
  { table: 'level_up_dispute_comments', userColumn: 'actor_user_id', dateColumn: 'created_at' },

  // Command trails: one row per command a member ran in a plugin, actor and time from the member's
  // own request. A denied command counts too — the member still turned up. These cover the whole
  // product surface and reach back to before `login_events` had a writer, so they are what makes the
  // launch weeks report a real number.
  { table: 'weekly_performance_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'gdp_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'workforce_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'trust_admin_audit_trail', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'trust_transport_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'trust_transport_status_events', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'socket_relay_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'socket_relay_request_events', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'foundation_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'foundation_quote_status_events', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'lighthouse_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'service_credits_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'peer_programming_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'beacon_events_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'safety_admin_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'contributor_access_audit_trail', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'recurring_activity_audit_trail', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'skills_hunt_audit_log', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'skills_taxonomy_change_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'level_up_audit_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'contributions_audit_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'directory_profile_change_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'account_restrictions_audit', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'unlock_audit_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'quora_deletion_survey_audit_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'quora_live_census_audit_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
  { table: 'feed_membership_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'announcement_membership_events', userColumn: 'actor_id', dateColumn: 'created_at' },
  { table: 'llm_inference_log', userColumn: 'actor_user_id', dateColumn: 'created_at' },
];

// Actor ids that are not a person. The app writes these into the same columns members are written
// into: a scheduled run records itself as the actor, the Commons standing notice is authored by the
// platform, and a request with no signed-in member falls back to 'anonymous'. Left in, each one
// would read as a member who turned up that day — the Commons notice has been doing exactly that,
// adding a person to the headcount who does not exist. Excluded here so the number only ever counts
// people.
export const NON_MEMBER_ACTIVITY_ACTOR_IDS: readonly string[] = [
  'anonymous',
  'system',
  'system:commons-guidance',
  'skills-hunt-auto-mission-scheduler',
  'level-up-auto-cohort-scheduler',
  'unlock-incentive-system',
  'internal_service_credits_reclaimer',
];

// Which of the sources this database actually has. Probed in one round trip rather than one query
// per table, and remembered for the life of the process: a table is created (or not) at deploy time
// and does not appear or disappear while the process runs. An empty or failed probe is not cached,
// so a transient error cannot latch the reading to "no sources".
let cachedSources: MemberActivitySource[] | null = null;

async function availableSources(): Promise<MemberActivitySource[]> {
  if (cachedSources) {
    return cachedSources;
  }
  const result = await queryDb<{ table_name: string }>(
    `SELECT candidate AS table_name
     FROM unnest($1::text[]) AS candidate
     WHERE to_regclass('public.' || candidate) IS NOT NULL`,
    [MEMBER_ACTIVITY_SOURCES.map((source) => source.table)],
  );
  const present = new Set(result.rows.map((row) => row.table_name));
  const sources = MEMBER_ACTIVITY_SOURCES.filter((source) => present.has(source.table));
  if (sources.length > 0) {
    cachedSources = sources;
  }
  return sources;
}

// Builds the (member, UTC day) set for a window. `windowClause` receives the source's own date
// column so each source is windowed on the timestamp its own rows carry. UNION rather than UNION
// ALL, so a member who appears in several sources on one day is still one member-day. `$2` is the
// non-member actor list, bound once and applied to every source.
function memberDaysSql(sources: MemberActivitySource[], windowClause: (dateColumn: string) => string): string {
  return sources
    .map(
      (source) =>
        `SELECT ${source.userColumn} AS user_id,
                (${source.dateColumn} AT TIME ZONE 'UTC')::date AS activity_day
         FROM ${source.table}
         WHERE ${windowClause(source.dateColumn)}
           AND ${source.userColumn} IS NOT NULL
           AND btrim(${source.userColumn}) <> ''
           AND btrim(${source.userColumn}) <> ALL ($2::text[])`,
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
  const result = await queryDb<T>(wrap(`(\n${memberDaysSql(sources, windowClause)}\n         )`), [
    parameter,
    NON_MEMBER_ACTIVITY_ACTOR_IDS,
  ]);
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
  const sources = await availableSources();
  const present = new Set(sources.map((source) => source.table));
  const rows = await Promise.all(
    MEMBER_ACTIVITY_SOURCES.map(async (source) => {
      if (!present.has(source.table)) {
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
             AND btrim(${source.userColumn}) <> ALL ($2::text[])
         ) source_days`,
        [weekStartDate, NON_MEMBER_ACTIVITY_ACTOR_IDS],
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
