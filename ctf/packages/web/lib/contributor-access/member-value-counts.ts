import { queryDb } from 'lib/db/postgres';
import type { ContributorValueEventKey } from './weights';

// Contributor Access — per-member ALL-TIME counts of the fifteen value events.
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

type EventQuery = { key: ContributorValueEventKey; tables: string | string[]; sql: string };

// One grouped query per value event. The attribution column (who earned the count) is the member
// who delivered the value in that plugin's flow.
const EVENT_QUERIES: EventQuery[] = [
  {
    // Attributed to the provider who answered (callee_user_id). Internal-only — see header.
    key: 'value.foundation_calls_answered',
    tables: 'foundation_call_sessions',
    sql: `SELECT callee_user_id AS member_id, COUNT(*)::text AS v FROM foundation_call_sessions
          WHERE ring_status = 'answered' AND blocks_charged > 0 AND callee_user_id IS NOT NULL
          GROUP BY callee_user_id`,
  },
  {
    // Attributed to the fulfiller.
    key: 'value.socket_relay_requests_fulfilled',
    tables: 'socket_relay_fulfillments',
    sql: `SELECT fulfiller_user_id AS member_id, COUNT(*)::text AS v FROM socket_relay_fulfillments
          WHERE close_reason = 'successful'
          GROUP BY fulfiller_user_id`,
  },
  {
    // Attributed to the provider.
    key: 'value.trust_transport_trips_completed',
    tables: 'trust_transport_trips',
    sql: `SELECT provider_user_id AS member_id, COUNT(*)::text AS v FROM trust_transport_trips
          WHERE status = 'completed' AND requester_completion_confirmed_at IS NOT NULL
            AND provider_completion_confirmed_at IS NOT NULL
          GROUP BY provider_user_id`,
  },
  {
    // Attributed to the host.
    key: 'value.lighthouse_stays_completed',
    tables: 'lighthouse_matches',
    sql: `SELECT host_user_id AS member_id, COUNT(*)::text AS v FROM lighthouse_matches
          WHERE status = 'completed'
          GROUP BY host_user_id`,
  },
  {
    // Attributed to the tipper (sender).
    key: 'value.chyme_tips_sent',
    tables: 'service_credits_transfers',
    sql: `SELECT sender_user_id AS member_id, COUNT(*)::text AS v FROM service_credits_transfers
          WHERE status = 'completed' AND origin_plugin = 'chyme' AND sender_user_id <> recipient_user_id
          GROUP BY sender_user_id`,
  },
  {
    // Attributed to the sender of a direct peer send.
    key: 'value.service_credits_peer_sends',
    tables: 'service_credits_transfers',
    sql: `SELECT sender_user_id AS member_id, COUNT(*)::text AS v FROM service_credits_transfers
          WHERE status = 'completed' AND origin_plugin = 'service-credits' AND sender_user_id <> recipient_user_id
          GROUP BY sender_user_id`,
  },
  {
    // SUM of confirmed USD (not a row count) — the weight is per dollar (see weights.ts).
    key: 'value.contributions_confirmed_usd',
    tables: 'contributions_submissions',
    sql: `SELECT user_id AS member_id, COALESCE(SUM(confirmed_amount_usd), 0)::text AS v
          FROM contributions_submissions
          WHERE status = 'confirmed'
          GROUP BY user_id`,
  },
  {
    // Attributed to the scout who submitted the accepted nomination.
    key: 'value.skills_hunt_nominations_accepted',
    tables: 'skills_hunt_submissions',
    sql: `SELECT submitter_user_id AS member_id, COUNT(*)::text AS v FROM skills_hunt_submissions
          WHERE status = 'accepted' AND deleted_at IS NULL
          GROUP BY submitter_user_id`,
  },
  {
    // Attributed to the member who suggested the approved tool.
    key: 'value.what_works_tools_approved',
    tables: 'what_works_products',
    sql: `SELECT suggested_by AS member_id, COUNT(*)::text AS v FROM what_works_products
          WHERE status = 'approved' AND suggested_by IS NOT NULL
          GROUP BY suggested_by`,
  },
  {
    key: 'value.what_works_endorsements_given',
    tables: 'what_works_endorsements',
    sql: `SELECT user_id AS member_id, COUNT(*)::text AS v FROM what_works_endorsements
          GROUP BY user_id`,
  },
  {
    // Attributed to the learner who completed.
    key: 'value.skill_up_completions',
    tables: 'skill_up_enrollments',
    sql: `SELECT user_id AS member_id, COUNT(*)::text AS v FROM skill_up_enrollments
          WHERE status = 'completed'
          GROUP BY user_id`,
  },
  {
    // Attributed to the trainer paid out.
    key: 'value.skill_up_trainer_payouts',
    tables: 'skill_up_disbursements',
    sql: `SELECT recipient_user_id AS member_id, COUNT(*)::text AS v FROM skill_up_disbursements
          WHERE disbursement_type = 'trainer_payout'
          GROUP BY recipient_user_id`,
  },
  {
    // A confirmed active tie credits BOTH sides (each side sustains the tie).
    key: 'value.recurring_ties_confirmed',
    tables: 'recurring_activities',
    sql: `SELECT member_id, COUNT(*)::text AS v FROM (
            SELECT owner_user_id AS member_id FROM recurring_activities
            WHERE status = 'active' AND confirmed_at IS NOT NULL
            UNION ALL
            SELECT counterparty_user_id AS member_id FROM recurring_activities
            WHERE status = 'active' AND confirmed_at IS NOT NULL
          ) sides
          GROUP BY member_id`,
  },
  {
    // Weekly Performance counts distinct posters per week; the all-time per-member analog of the
    // same events is the number of distinct weeks the member posted in (once per week, like the
    // weekly metric counts a member once per window).
    key: 'value.peer_programming_active_posters',
    tables: 'peer_programming_messages',
    sql: `SELECT author_user_id AS member_id, COUNT(DISTINCT DATE_TRUNC('week', created_at))::text AS v
          FROM peer_programming_messages
          GROUP BY author_user_id`,
  },
  {
    // Distinct broadcasts the member engaged with (reaction or reply on the Commons replay post) —
    // same (member, broadcast)-pair dedupe as the weekly metric, all-time.
    key: 'value.beacon_broadcast_engagement',
    tables: ['beacon_events', 'feed_community_post_reactions', 'feed_community_replies'],
    sql: `SELECT member_id, COUNT(*)::text AS v FROM (
            SELECT r.user_id AS member_id, b.id AS broadcast_id
            FROM beacon_events b
            JOIN feed_community_post_reactions r ON r.post_id = b.commons_recording_post_id
            UNION
            SELECT p.author_user_id AS member_id, b.id AS broadcast_id
            FROM beacon_events b
            JOIN feed_community_replies p ON p.post_id = b.commons_recording_post_id
          ) engagement
          GROUP BY member_id`,
  },
];

// All-time per-member counts for every value event. Members with no events do not appear.
export async function computeMemberEventCounts(): Promise<MemberEventCounts> {
  const counts: MemberEventCounts = new Map();
  const rowSets = await Promise.all(EVENT_QUERIES.map((q) => guardedMemberRows(q.tables, q.sql)));
  EVENT_QUERIES.forEach((q, index) => {
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
// (seeker_user_id / host_user_id — completed stays), and recurring_activities (owner_user_id /
// counterparty_user_id — confirmed active ties). Foundation call sessions are deliberately NOT
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
