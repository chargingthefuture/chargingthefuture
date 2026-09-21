import type { ContributorValueEventKey } from './weights';

// The thirteen value events, defined once, in the shape every reading needs.
//
// Three things read these events and they must never disagree:
//
//   * Weavers of the Commons sums them over a member's entire time here, applies the weights, and
//     grants a badge the first time the total clears the threshold. Permanent once earned.
//   * The daily exchange count asks the same question of one day: who delivered value today, and
//     how many of them were there.
//   * The Weekly Performance dashboard's Value section asks how many times each event happened in
//     a week — not who, just how often (owner directive, 2026-09-21: the dashboard reads this list
//     rather than keeping its own copy of the SQL).
//
// Same events, same attribution — the only difference is the window and what is done with the
// answer (owner directive, 2026-09-20). Before this file each reading carried its own copy of the
// SQL, which is how definitions drift: a feature lands, one list is updated, and the numbers quietly
// stop describing the same thing. Adding a value event now means adding one entry here and every
// reading picks it up.
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
  // Distinct `ref` values. Nothing uses this today — Beacon did, before it was removed — and it
  // stays because the next event that dedupes against a target will need it.
  | 'distinctRef';

// How many times an event happened in a window, for the Weekly Performance dashboard. The badge
// and the daily count score members; the dashboard counts occurrences, and the two are not the
// same question when a row credits a member rather than an event.
export type ValueEventOccurrences =
  // One occurrence per row. Most events.
  | 'rows'
  // Distinct members in the window. PeerProgramming: how many different people posted this week.
  | 'distinctMembers'
  // Distinct `ref` values. Recurring ties credit both sides with a row each, and the tie is the
  // occurrence, so the rows carry the tie's id as `ref`.
  | 'distinctRef'
  // Sum of `value`. Contributions: dollars confirmed this week.
  | 'sum';

export type ValueEventSource = {
  key: ContributorValueEventKey;
  // Whether somebody on the other side received something material.
  //
  // The badge scores every event: it is already gated on five distinct counterparties, so a member
  // who only talks can never earn it however long they keep talking, and narrowing what it scores
  // would move who qualifies. The daily count has no such gate — one event puts a member on the
  // day's roster — so it counts only the events marked here (owner directive, 2026-09-20). One
  // definition, one set of weights, and the difference stated rather than hidden.
  //
  // Receiving is not delivering: a learner finishing a course is marked false, and the trainer who
  // taught it is credited by their own payout event.
  delivers: boolean;
  // Every table the row SQL touches. A missing one makes the event contribute nothing rather than
  // failing the reading.
  tables: string[];
  // Rows of (member_id, at, value, ref). `value` is only read by the sum aggregate and `ref` only
  // by the distinct-ref one, so the others select a constant for them.
  rowSql: string;
  aggregate: ValueEventAggregate;
  occurrences: ValueEventOccurrences;
};

export const VALUE_EVENT_SOURCES: ValueEventSource[] = [
  {
    key: 'value.foundation_calls_answered',
    // A call answered is time given to the person who rang.
    delivers: true,
    tables: ['foundation_call_sessions'],
    rowSql: `SELECT callee_user_id AS member_id, answered_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM foundation_call_sessions
              WHERE ring_status = 'answered' AND blocks_charged > 0 AND callee_user_id IS NOT NULL`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.socket_relay_requests_fulfilled',
    // Somebody asked for something and got it.
    delivers: true,
    tables: ['socket_relay_fulfillments'],
    rowSql: `SELECT fulfiller_user_id AS member_id, COALESCE(closed_at, updated_at) AS at,
                    1::numeric AS value, NULL::text AS ref
               FROM socket_relay_fulfillments
              WHERE close_reason = 'successful'`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.trust_transport_trips_completed',
    // A ride, confirmed by both sides.
    delivers: true,
    tables: ['trust_transport_trips'],
    rowSql: `SELECT provider_user_id AS member_id, completed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM trust_transport_trips
              WHERE status = 'completed' AND requester_completion_confirmed_at IS NOT NULL
                AND provider_completion_confirmed_at IS NOT NULL`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.lighthouse_stays_completed',
    // Somebody had a roof over them.
    delivers: true,
    tables: ['lighthouse_matches'],
    rowSql: `SELECT host_user_id AS member_id, COALESCE(completed_at, updated_at) AS at,
                    1::numeric AS value, NULL::text AS ref
               FROM lighthouse_matches
              WHERE status = 'completed'`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.chyme_tips_sent',
    // Credits leave one member and reach another.
    delivers: true,
    tables: ['service_credits_transfers'],
    rowSql: `SELECT sender_user_id AS member_id, completed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM service_credits_transfers
              WHERE status = 'completed' AND origin_plugin = 'chyme'
                AND sender_user_id <> recipient_user_id`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.service_credits_peer_sends',
    // Credits leave one member and reach another.
    delivers: true,
    tables: ['service_credits_transfers'],
    rowSql: `SELECT sender_user_id AS member_id, completed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM service_credits_transfers
              WHERE status = 'completed' AND origin_plugin = 'service-credits'
                AND sender_user_id <> recipient_user_id`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.contributions_confirmed_usd',
    // Real money, confirmed. Nobody is on the other side of the row, but something material arrived.
    delivers: true,
    tables: ['contributions_submissions'],
    rowSql: `SELECT user_id AS member_id, reviewed_at AS at,
                    COALESCE(confirmed_amount_usd, 0)::numeric AS value, NULL::text AS ref
               FROM contributions_submissions
              WHERE status = 'confirmed'`,
    aggregate: 'sum',
    occurrences: 'sum',
  },
  {
    key: 'value.skills_hunt_nominations_accepted',
    // An accepted nomination becomes a listing for a real person who was not findable before.
    delivers: true,
    tables: ['skills_hunt_submissions'],
    rowSql: `SELECT submitter_user_id AS member_id, reviewed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM skills_hunt_submissions
              WHERE status = 'accepted' AND deleted_at IS NULL`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.what_works_tools_approved',
    // An approved tool is something other members go and use.
    delivers: true,
    tables: ['what_works_products'],
    rowSql: `SELECT suggested_by AS member_id, reviewed_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM what_works_products
              WHERE status = 'approved' AND suggested_by IS NOT NULL`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.skill_up_completions',
    // The learner received the teaching rather than gave it.
    delivers: false,
    tables: ['skill_up_enrollments'],
    rowSql: `SELECT user_id AS member_id, updated_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM skill_up_enrollments
              WHERE status = 'completed'`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    key: 'value.skill_up_trainer_payouts',
    // The trainer taught somebody.
    delivers: true,
    tables: ['skill_up_disbursements'],
    rowSql: `SELECT recipient_user_id AS member_id, created_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM skill_up_disbursements
              WHERE disbursement_type = 'trainer_payout'`,
    aggregate: 'count',
    occurrences: 'rows',
  },
  {
    // A confirmed active tie credits both sides: each of them sustains it.
    key: 'value.recurring_ties_confirmed',
    // A tie both sides confirm they are sustaining.
    delivers: true,
    tables: ['recurring_activities'],
    rowSql: `SELECT owner_user_id AS member_id, confirmed_at AS at, 1::numeric AS value, id::text AS ref
               FROM recurring_activities
              WHERE status = 'active' AND confirmed_at IS NOT NULL
              UNION ALL
             SELECT counterparty_user_id AS member_id, confirmed_at AS at, 1::numeric AS value, id::text AS ref
               FROM recurring_activities
              WHERE status = 'active' AND confirmed_at IS NOT NULL`,
    aggregate: 'count',
    occurrences: 'distinctRef',
  },
  {
    key: 'value.peer_programming_active_posters',
    // Posting in a cohort. Kept in the badge at a weight of 1 because a session exposes somebody there to extract, but nobody receives a thing from a message.
    delivers: false,
    tables: ['peer_programming_messages'],
    rowSql: `SELECT author_user_id AS member_id, created_at AS at, 1::numeric AS value, NULL::text AS ref
               FROM peer_programming_messages`,
    aggregate: 'distinctWeek',
    occurrences: 'distinctMembers',
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

// How many times an event happened in a window — the Weekly Performance dashboard's reading.
export function occurrencesExpression(occurrences: ValueEventOccurrences): string {
  switch (occurrences) {
    case 'sum':
      return 'COALESCE(SUM(value), 0)';
    case 'distinctMembers':
      return 'COUNT(DISTINCT member_id)';
    case 'distinctRef':
      return 'COUNT(DISTINCT ref)';
    case 'rows':
    default:
      return 'COUNT(*)';
  }
}

// The events the daily count draws on: the ones where somebody received something material.
export const DELIVERING_VALUE_EVENT_SOURCES = VALUE_EVENT_SOURCES.filter((source) => source.delivers);
