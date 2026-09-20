import type { ContributorValueEventKey } from './weights';

// The fifteen value events, defined once, in the shape both readings need.
//
// Two things read these events and they must never disagree:
//
//   * Weavers of the Commons sums them over a member's entire time here, applies the weights, and
//     grants a badge the first time the total clears the threshold. Permanent once earned.
//   * The daily exchange count asks the same question of one day: who delivered value today, and
//     how many of them were there.
//
// Same events, same weights, same attribution — the only difference is the window and what is done
// with the answer (owner directive, 2026-09-20). Before this file each reading carried its own copy
// of the SQL, which is how two definitions drift: a feature lands, one list is updated, and the two
// numbers quietly stop describing the same thing. Adding a value event now means adding one entry
// here and both readings pick it up.
//
// Each entry gives a row-level SELECT — one row per occurrence, carrying the member it is
// attributed to and when it happened — plus how that event aggregates over a window. Attribution is
// to the member who DELIVERED the value (provider, host, fulfiller, sender, scout, author), which
// is what the badge has always counted, so a ride credits its driver.
//
// Every table and column name is a fixed literal. No caller input is ever interpolated into SQL.
//
// Rule 132: Foundation answered charged calls are sensitive participation. They stay internal —
// inside the badge's reason snapshot and inside an admin-only reading — and never reach a
// member-facing surface, which is why no per-event breakdown is exposed for a named member.

export type ValueEventAggregate =
  // One point per row. Most events.
  | 'count'
  // Sum of the row's `value` column. Contributions, whose weight is per dollar.
  | 'sum'
  // Distinct calendar weeks the member appeared in. PeerProgramming counts a member once per week.
  | 'distinctWeek'
  // Distinct `ref` values. Beacon counts a member once per broadcast however often they engaged.
  | 'distinctRef';

export type ValueEventSource = {
  key: ContributorValueEventKey;
  // Every table the row SQL touches. A missing one makes the event contribute nothing rather than
  // failing the whole reading.
  tables: string[];
  // Rows of (member_id, at, value, ref). `value` is only read by the sum aggregate and `ref` only
  // by the distinct-ref one, so the others select a constant for them.
  rowSql: string;
  aggregate: ValueEventAggregate;
};

export const VALUE_EVENT_SOURCES: ValueEventSource[] = [
  {
    key: 'value.foundation_calls_answered',
    tables: ['foundation_call_sessions'],
    rowSql: `SELECT callee_user_id AS member_id, answered_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM foundation_call_sessions
              WHERE ring_status = 'answered' AND blocks_charged > 0 AND callee_user_id IS NOT NULL`,
    aggregate: 'count',
  },
  {
    key: 'value.socket_relay_requests_fulfilled',
    tables: ['socket_relay_fulfillments'],
    rowSql: `SELECT fulfiller_user_id AS member_id, COALESCE(closed_at, updated_at) AS at,
                    1::numeric AS value, NULL::text AS ref
               FROM socket_relay_fulfillments
              WHERE close_reason = 'successful'`,
    aggregate: 'count',
  },
  {
    key: 'value.trust_transport_trips_completed',
    tables: ['trust_transport_trips'],
    rowSql: `SELECT provider_user_id AS member_id, completed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM trust_transport_trips
              WHERE status = 'completed' AND requester_completion_confirmed_at IS NOT NULL
                AND provider_completion_confirmed_at IS NOT NULL`,
    aggregate: 'count',
  },
  {
    key: 'value.lighthouse_stays_completed',
    tables: ['lighthouse_matches'],
    rowSql: `SELECT host_user_id AS member_id, COALESCE(completed_at, updated_at) AS at,
                    1::numeric AS value, NULL::text AS ref
               FROM lighthouse_matches
              WHERE status = 'completed'`,
    aggregate: 'count',
  },
  {
    key: 'value.chyme_tips_sent',
    tables: ['service_credits_transfers'],
    rowSql: `SELECT sender_user_id AS member_id, completed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM service_credits_transfers
              WHERE status = 'completed' AND origin_plugin = 'chyme'
                AND sender_user_id <> recipient_user_id`,
    aggregate: 'count',
  },
  {
    key: 'value.service_credits_peer_sends',
    tables: ['service_credits_transfers'],
    rowSql: `SELECT sender_user_id AS member_id, completed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM service_credits_transfers
              WHERE status = 'completed' AND origin_plugin = 'service-credits'
                AND sender_user_id <> recipient_user_id`,
    aggregate: 'count',
  },
  {
    key: 'value.contributions_confirmed_usd',
    tables: ['contributions_submissions'],
    rowSql: `SELECT user_id AS member_id, reviewed_at AS at,
                    COALESCE(confirmed_amount_usd, 0)::numeric AS value, NULL::text AS ref
               FROM contributions_submissions
              WHERE status = 'confirmed'`,
    aggregate: 'sum',
  },
  {
    key: 'value.skills_hunt_nominations_accepted',
    tables: ['skills_hunt_submissions'],
    rowSql: `SELECT submitter_user_id AS member_id, reviewed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM skills_hunt_submissions
              WHERE status = 'accepted' AND deleted_at IS NULL`,
    aggregate: 'count',
  },
  {
    key: 'value.what_works_tools_approved',
    tables: ['what_works_products'],
    rowSql: `SELECT suggested_by AS member_id, reviewed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM what_works_products
              WHERE status = 'approved' AND suggested_by IS NOT NULL`,
    aggregate: 'count',
  },
  {
    key: 'value.what_works_endorsements_given',
    tables: ['what_works_endorsements'],
    rowSql: `SELECT user_id AS member_id, created_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM what_works_endorsements`,
    aggregate: 'count',
  },
  {
    key: 'value.skill_up_completions',
    tables: ['skill_up_enrollments'],
    rowSql: `SELECT user_id AS member_id, updated_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM skill_up_enrollments
              WHERE status = 'completed'`,
    aggregate: 'count',
  },
  {
    key: 'value.skill_up_trainer_payouts',
    tables: ['skill_up_disbursements'],
    rowSql: `SELECT recipient_user_id AS member_id, created_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM skill_up_disbursements
              WHERE disbursement_type = 'trainer_payout'`,
    aggregate: 'count',
  },
  {
    // A confirmed active tie credits both sides: each of them sustains it.
    key: 'value.recurring_ties_confirmed',
    tables: ['recurring_activities'],
    rowSql: `SELECT owner_user_id AS member_id, confirmed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM recurring_activities
              WHERE status = 'active' AND confirmed_at IS NOT NULL
              UNION ALL
             SELECT counterparty_user_id AS member_id, confirmed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM recurring_activities
              WHERE status = 'active' AND confirmed_at IS NOT NULL`,
    aggregate: 'count',
  },
  {
    key: 'value.peer_programming_active_posters',
    tables: ['peer_programming_messages'],
    rowSql: `SELECT author_user_id AS member_id, created_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM peer_programming_messages`,
    aggregate: 'distinctWeek',
  },
  {
    // One point per broadcast engaged with, however many reactions or replies the member left on it.
    key: 'value.beacon_broadcast_engagement',
    tables: ['beacon_events', 'feed_community_post_reactions', 'feed_community_replies'],
    rowSql: `SELECT r.user_id AS member_id, r.created_at AS at, 1::numeric AS value, b.id::text AS ref
               FROM beacon_events b
               JOIN feed_community_post_reactions r ON r.post_id = b.commons_recording_post_id
              UNION ALL
             SELECT p.author_user_id AS member_id, p.created_at AS at, 1::numeric AS value, b.id::text AS ref
               FROM beacon_events b
               JOIN feed_community_replies p ON p.post_id = b.commons_recording_post_id`,
    aggregate: 'distinctRef',
  },
];

// How one event's rows aggregate into the number the weight multiplies. Written once so the
// all-time reading and any windowed reading cannot disagree about what an event is worth.
export function aggregateExpression(aggregate: ValueEventAggregate): string {
  switch (aggregate) {
    case 'sum':
      return 'COALESCE(SUM(value), 0)';
    case 'distinctWeek':
      return `COUNT(DISTINCT DATE_TRUNC('week', at))`;
    case 'distinctRef':
      return 'COUNT(DISTINCT ref)';
    case 'count':
    default:
      return 'COUNT(*)';
  }
}
