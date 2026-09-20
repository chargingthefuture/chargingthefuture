import { queryDb } from 'lib/db/postgres';

// What "exchanged with somebody" means on this platform, in one place.
//
// A member exchanged on a day when a completed row exists for that day naming them and another
// member as the two sides of it: a ride given, a room stayed in, a call answered, a quote settled,
// a request fulfilled, credits sent, a trainer paid for a learner. Both sides of every row count,
// because the goal is people working with each other and a ride involves two of them.
//
// This is deliberately not the sign-in reading in `member-activity.ts`. Turning up and trading are
// different things, and that file says so at length. This one never reads `login_events`.
//
// It is also not the Weavers of the Commons badge. That badge sums the same kinds of event over a
// member's entire time here, gates on account age and permanence, and once earned it never lapses,
// so it can say who has ever contributed and can never say what happened today.
//
// What is left out, and why:
//   * Anything one-sided. A nomination, an endorsement, a confirmed contribution, a post — real
//     work, nobody on the other side of the row, so it cannot say two members worked together.
//   * Recurring Activity. Its row records an ongoing tie confirmed once, not a thing that happened
//     on a day, so counting it daily would credit the confirmation and nothing after it.
//
// Two sources date a row by `updated_at` because their table has no completion column: LightHouse
// matches and SocketRelay fulfillments. That is a proxy — a later edit to a finished row moves it to
// the day of the edit. It is named here rather than hidden, and the fix is a completion column on
// those two tables rather than a cleverer query.
//
// Read-only, counts only. Every table and column name below is a fixed literal; only the window
// bound travels as a bound parameter.

export type ExchangeDay = {
  day: string;
  members: number;
};

export type ExchangeActivityReading = {
  readAt: string;
  target: number;
  today: number;
  bestDay: ExchangeDay | null;
  daysAtTarget: number;
  days: ExchangeDay[];
};

// 384 is the sample size at which a reading generalizes to a population of five million, which is
// the estimate this project works from. So a day at 384 is evidence the arrangement holds at that
// scale — not a headcount to accumulate, and not the same 384 people twice.
export const DAILY_EXCHANGE_TARGET = 384;

// One row per member per side of a completed exchange, with the day it happened. Both directions of
// every pair are emitted, and the outer query counts distinct members per day, so a member who did
// four things on one day counts once and a ride counts its two people.
const MEMBER_DAYS_SQL = `
  SELECT provider_user_id AS user_id, (completed_at AT TIME ZONE 'UTC')::date AS day
    FROM trust_transport_trips
   WHERE status = 'completed' AND completed_at IS NOT NULL
  UNION ALL
  SELECT requester_user_id, (completed_at AT TIME ZONE 'UTC')::date
    FROM trust_transport_trips
   WHERE status = 'completed' AND completed_at IS NOT NULL
  UNION ALL
  SELECT sender_user_id, (completed_at AT TIME ZONE 'UTC')::date
    FROM service_credits_transfers
   WHERE status = 'completed' AND completed_at IS NOT NULL
  UNION ALL
  SELECT recipient_user_id, (completed_at AT TIME ZONE 'UTC')::date
    FROM service_credits_transfers
   WHERE status = 'completed' AND completed_at IS NOT NULL
  UNION ALL
  SELECT callee_user_id, (answered_at AT TIME ZONE 'UTC')::date
    FROM foundation_call_sessions
   WHERE ring_status = 'answered' AND answered_at IS NOT NULL
  UNION ALL
  SELECT caller_user_id, (answered_at AT TIME ZONE 'UTC')::date
    FROM foundation_call_sessions
   WHERE ring_status = 'answered' AND answered_at IS NOT NULL
  UNION ALL
  SELECT provider_user_id, (settled_at AT TIME ZONE 'UTC')::date
    FROM foundation_quote_requests
   WHERE lifecycle_state = 'closed' AND settled_at IS NOT NULL
  UNION ALL
  SELECT survivor_user_id, (settled_at AT TIME ZONE 'UTC')::date
    FROM foundation_quote_requests
   WHERE lifecycle_state = 'closed' AND settled_at IS NOT NULL
  UNION ALL
  SELECT fulfiller_user_id, (updated_at AT TIME ZONE 'UTC')::date
    FROM socket_relay_fulfillments
   WHERE close_reason = 'successful' AND updated_at IS NOT NULL
  UNION ALL
  SELECT requester_user_id, (updated_at AT TIME ZONE 'UTC')::date
    FROM socket_relay_fulfillments
   WHERE close_reason = 'successful' AND updated_at IS NOT NULL
  UNION ALL
  SELECT host_user_id, (updated_at AT TIME ZONE 'UTC')::date
    FROM lighthouse_matches
   WHERE status = 'completed' AND updated_at IS NOT NULL
  UNION ALL
  SELECT seeker_user_id, (updated_at AT TIME ZONE 'UTC')::date
    FROM lighthouse_matches
   WHERE status = 'completed' AND updated_at IS NOT NULL
  UNION ALL
  SELECT d.recipient_user_id, (d.created_at AT TIME ZONE 'UTC')::date
    FROM skill_up_disbursements d
   WHERE d.disbursement_type = 'trainer_payout' AND d.created_at IS NOT NULL
  UNION ALL
  SELECT e.user_id, (d.created_at AT TIME ZONE 'UTC')::date
    FROM skill_up_disbursements d
    JOIN skill_up_enrollments e ON e.id = d.enrollment_id
   WHERE d.disbursement_type = 'trainer_payout' AND d.created_at IS NOT NULL
`;

type DayRow = { day: string; members: string };

function count(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

// A day with no exchange writes no row, so the gaps are filled here rather than left for a reader to
// mistake for missing data. A quiet day is a real reading and should show as a zero.
function fillGaps(rows: ExchangeDay[], days: number): ExchangeDay[] {
  const byDay = new Map(rows.map((row) => [row.day, row.members]));
  const out: ExchangeDay[] = [];
  const today = new Date();

  for (let back = days - 1; back >= 0; back -= 1) {
    const at = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - back));
    const day = at.toISOString().slice(0, 10);
    out.push({ day, members: byDay.get(day) ?? 0 });
  }

  return out;
}

export async function readDailyExchangeActivity(days = 30): Promise<ExchangeActivityReading> {
  const window = Number.isFinite(days) && days > 0 ? Math.min(Math.trunc(days), 365) : 30;

  const recent = await queryDb<DayRow>(
    `
      SELECT day::text AS day, COUNT(DISTINCT user_id)::text AS members
        FROM (${MEMBER_DAYS_SQL}) AS member_days
       WHERE user_id IS NOT NULL
         AND day > (NOW() AT TIME ZONE 'UTC')::date - $1::int
       GROUP BY day
       ORDER BY day
    `,
    [window],
  );

  // The best day is read across every day on record, not only the window on screen, so the figure
  // does not fall when the window scrolls past it.
  const best = await queryDb<DayRow>(
    `
      SELECT day::text AS day, members::text AS members
        FROM (
          SELECT day, COUNT(DISTINCT user_id) AS members
            FROM (${MEMBER_DAYS_SQL}) AS member_days
           WHERE user_id IS NOT NULL
           GROUP BY day
        ) AS per_day
       ORDER BY members DESC, day DESC
       LIMIT 1
    `,
  );

  const atTarget = await queryDb<{ days_at_target: string }>(
    `
      SELECT COUNT(*)::text AS days_at_target
        FROM (
          SELECT day, COUNT(DISTINCT user_id) AS members
            FROM (${MEMBER_DAYS_SQL}) AS member_days
           WHERE user_id IS NOT NULL
           GROUP BY day
        ) AS per_day
       WHERE members >= $1::int
    `,
    [DAILY_EXCHANGE_TARGET],
  );

  const days_ = fillGaps(
    recent.rows.map((row) => ({ day: row.day, members: count(row.members) })),
    window,
  );

  const bestRow = best.rows[0];

  return {
    readAt: new Date().toISOString(),
    target: DAILY_EXCHANGE_TARGET,
    today: days_[days_.length - 1]?.members ?? 0,
    bestDay: bestRow ? { day: bestRow.day, members: count(bestRow.members) } : null,
    daysAtTarget: count(atTarget.rows[0]?.days_at_target),
    days: days_,
  };
}
