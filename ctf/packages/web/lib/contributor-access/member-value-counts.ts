import { queryDb } from 'lib/db/postgres';
import type { ContributorValueEventKey } from './weights';
import { VALUE_EVENT_SOURCES, aggregateExpression, type ValueEventSource } from './value-events';

// Contributor Access — per-member ALL-TIME counts of the fourteen value events.
//
// Each query counts the SAME events as lib/weekly-performance/live-metrics.ts (same tables, same
// fixed filters), with two differences: no week window (all-time), and grouped per the member who
// DELIVERED the value (provider/host/fulfiller/sender/author — not the receiver). Every query is
// guarded on table existence and never throws: a missing table or a read error contributes nothing.
// All table and column names are fixed literals — no user input is interpolated into SQL.
//
// Foundation answered charged calls: counted here per member (the callee who answered) as internal
// gating fuel ONLY. Per rule 132 this participation is sensitive (wellbeing/payment) and MUST never
// be exposed on any member-facing surface — it stays inside reason_snapshot, which no member API
// ever returns.

export type MemberEventCounts = Map<string, Partial<Record<ContributorValueEventKey, number>>>;

async function tableExists(table: string): Promise<boolean> {
  const reg = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [`public.${table}`]);
  return !!reg.rows[0]?.reg;
}

// Run one grouped per-member scalar query (columns aliased `member_id`, `v`) guarded on the
// existence of every table it touches. Returns [] on a missing table or any read error.
async function guardedMemberRows(
  tables: string | string[],
  sql: string,
): Promise<{ member_id: string; v: string | null }[]> {
  try {
    const needed = Array.isArray(tables) ? tables : [tables];
    for (const table of needed) {
      if (!(await tableExists(table))) return [];
    }
    const result = await queryDb<{ member_id: string; v: string | null }>(sql);
    return result.rows;
  } catch {
    return [];
  }
}

// The event definitions now live in ./value-events.ts, shared with the daily exchange reading, so
// the badge and that reading can never disagree about what an event is or who it is attributed to
// (owner directive, 2026-09-20). This file keeps what is specific to the badge: no window, and the
// per-member shape the eligibility engine wants.
//
// Each all-time query is derived from an event's row SQL plus its aggregate, which is exactly what
// each hand-written query here used to spell out.
function allTimeSql(source: ValueEventSource): string {
  return `SELECT member_id, ${aggregateExpression(source.aggregate)}::text AS v
            FROM (${source.rowSql}) AS rows
           WHERE member_id IS NOT NULL
           GROUP BY member_id`;
}

// All-time per-member counts for every value event. Members with no events do not appear.
export async function computeMemberEventCounts(): Promise<MemberEventCounts> {
  const counts: MemberEventCounts = new Map();
  const rowSets = await Promise.all(
    VALUE_EVENT_SOURCES.map((source) => guardedMemberRows(source.tables, allTimeSql(source))),
  );
  VALUE_EVENT_SOURCES.forEach((q, index) => {
    for (const row of rowSets[index]) {
      if (!row.member_id) continue;
      const value = row.v == null ? 0 : Number(row.v);
      if (!Number.isFinite(value) || value <= 0) continue;
      const entry = counts.get(row.member_id) ?? {};
      entry[q.key] = value;
      counts.set(row.member_id, entry);
    }
  });
  return counts;
}

// Distinct counterparties per member across the two-sided events, using the real counterparty
// columns: service_credits_transfers (sender_user_id / recipient_user_id — completed, any
// origin_plugin, never self-to-self), trust_transport_trips (requester_user_id /
// provider_user_id — both-sides-confirmed completions), socket_relay_fulfillments
// (requester_user_id / fulfiller_user_id — closed successful), lighthouse_matches
// (seeker_user_id / host_user_id — completed stays), recurring_activities (owner_user_id /
// counterparty_user_id — confirmed active ties), and PeerProgramming goal cards marked as helped
// (the helper / the goal's owner; the goals table is created with the tasks table, so checking the
// tasks table covers the join). Foundation call sessions are deliberately NOT
// read here: their per-member counts already feed the score internally, and keeping the sensitive
// table out of the diversity read minimizes its access surface (rule 132).
export async function computeMemberCounterpartyCounts(): Promise<Map<string, number>> {
  const pairQueries: { tables: string; sql: string }[] = [
    {
      tables: 'service_credits_transfers',
      sql: `SELECT sender_user_id AS member_id, recipient_user_id AS other_id FROM service_credits_transfers
            WHERE status = 'completed' AND sender_user_id <> recipient_user_id
            UNION
            SELECT recipient_user_id, sender_user_id FROM service_credits_transfers
            WHERE status = 'completed' AND sender_user_id <> recipient_user_id`,
    },
    {
      tables: 'trust_transport_trips',
      sql: `SELECT provider_user_id AS member_id, requester_user_id AS other_id FROM trust_transport_trips
            WHERE status = 'completed' AND requester_completion_confirmed_at IS NOT NULL
              AND provider_completion_confirmed_at IS NOT NULL
            UNION
            SELECT requester_user_id, provider_user_id FROM trust_transport_trips
            WHERE status = 'completed' AND requester_completion_confirmed_at IS NOT NULL
              AND provider_completion_confirmed_at IS NOT NULL`,
    },
    {
      tables: 'socket_relay_fulfillments',
      sql: `SELECT fulfiller_user_id AS member_id, requester_user_id AS other_id FROM socket_relay_fulfillments
            WHERE close_reason = 'successful'
            UNION
            SELECT requester_user_id, fulfiller_user_id FROM socket_relay_fulfillments
            WHERE close_reason = 'successful'`,
    },
    {
      tables: 'lighthouse_matches',
      sql: `SELECT host_user_id AS member_id, seeker_user_id AS other_id FROM lighthouse_matches
            WHERE status = 'completed'
            UNION
            SELECT seeker_user_id, host_user_id FROM lighthouse_matches
            WHERE status = 'completed'`,
    },
    {
      tables: 'peer_programming_goal_tasks',
      sql: `SELECT t.taken_by_user_id AS member_id, g.owner_user_id AS other_id
              FROM peer_programming_goal_tasks t JOIN peer_programming_goals g ON g.id = t.goal_id
             WHERE t.helped AND t.taken_by_user_id IS NOT NULL AND t.taken_by_user_id <> 'deleted_member'
            UNION
            SELECT g.owner_user_id, t.taken_by_user_id
              FROM peer_programming_goal_tasks t JOIN peer_programming_goals g ON g.id = t.goal_id
             WHERE t.helped AND t.taken_by_user_id IS NOT NULL AND t.taken_by_user_id <> 'deleted_member'`,
    },
    {
      tables: 'recurring_activities',
      sql: `SELECT owner_user_id AS member_id, counterparty_user_id AS other_id FROM recurring_activities
            WHERE status = 'active' AND confirmed_at IS NOT NULL
            UNION
            SELECT counterparty_user_id, owner_user_id FROM recurring_activities
            WHERE status = 'active' AND confirmed_at IS NOT NULL`,
    },
  ];

  const pairs = new Map<string, Set<string>>();
  const rowSets = await Promise.all(
    pairQueries.map(async (q) => {
      try {
        if (!(await tableExists(q.tables))) return [];
        const result = await queryDb<{ member_id: string; other_id: string }>(q.sql);
        return result.rows;
      } catch {
        return [];
      }
    }),
  );
  for (const rows of rowSets) {
    for (const row of rows) {
      if (!row.member_id || !row.other_id || row.member_id === row.other_id) continue;
      const set = pairs.get(row.member_id) ?? new Set<string>();
      set.add(row.other_id);
      pairs.set(row.member_id, set);
    }
  }
  return new Map([...pairs.entries()].map(([memberId, set]) => [memberId, set.size]));
}

// First login per member (login_events MIN(created_at)) — the account-age gate's anchor. A member
// with no login row has no measurable age and fails the age gate until they sign in once.
export async function computeMemberFirstLogin(): Promise<Map<string, string>> {
  try {
    if (!(await tableExists('login_events'))) return new Map();
    const result = await queryDb<{ member_id: string; first_login: string }>(
      `SELECT user_id AS member_id, MIN(created_at)::text AS first_login FROM login_events GROUP BY user_id`,
    );
    return new Map(result.rows.filter((r) => !!r.member_id).map((r) => [r.member_id, r.first_login]));
  } catch {
    return new Map();
  }
}
