import type { PoolClient } from 'pg';
import { queryDb } from 'lib/db/postgres';

// Action minutes (3.1.0, owner-approved plan, Measures). Minutes connected in a room or a call, 30
// for a task its author confirmed, and 10 for a "This helped me" its author confirmed (nothing
// records that confirmation yet, so it adds nothing). Time with the app open counts for nothing.
// Days won = all members' action minutes ÷ 480.
//
// Room and Back Channel seconds are credited per member on each heartbeat into
// member_action_seconds_daily. Foundation calls (answered to ended, each side, capped at four hours)
// and confirmed PeerProgramming tasks are read from their own tables.

export const ACTION_MINUTES_PER_DAY_WON = 480;
export const CONFIRMED_TASK_MINUTES = 30;

export type ActionSource = 'chyme-room' | 'back-channel';

export async function creditActionSeconds(client: PoolClient, userId: string, source: ActionSource, seconds: number): Promise<void> {
  if (!userId || !Number.isFinite(seconds) || seconds <= 0) return;
  await client.query(
    `INSERT INTO member_action_seconds_daily (user_id, usage_date, source, seconds, updated_at)
     VALUES ($1, (NOW() AT TIME ZONE 'UTC')::date, $2, $3, NOW())
     ON CONFLICT (user_id, usage_date, source)
     DO UPDATE SET seconds = member_action_seconds_daily.seconds + EXCLUDED.seconds, updated_at = NOW()`,
    [userId, source, Math.floor(seconds)],
  );
}

// Every member's action minutes per UTC day, from all three sources. Interpolated into the reads
// below; $1 is the first day counted (inclusive).
export const DAILY_MINUTES_CTE = `
  minutes AS (
    SELECT user_id, usage_date AS day, seconds / 60.0 AS m
      FROM member_action_seconds_daily WHERE usage_date >= $1::date
    UNION ALL
    SELECT side.user_id, (s.answered_at AT TIME ZONE 'UTC')::date,
           LEAST(EXTRACT(EPOCH FROM (s.ended_at - s.answered_at)) / 60.0, 240)
      FROM foundation_call_sessions s
      CROSS JOIN LATERAL (VALUES (s.caller_user_id), (s.callee_user_id)) AS side(user_id)
     WHERE s.answered_at IS NOT NULL AND s.ended_at IS NOT NULL AND s.ended_at > s.answered_at
       AND side.user_id IS NOT NULL AND (s.answered_at AT TIME ZONE 'UTC')::date >= $1::date
    UNION ALL
    SELECT taken_by_user_id, (kept_at AT TIME ZONE 'UTC')::date, ${CONFIRMED_TASK_MINUTES}
      FROM peer_programming_goal_tasks
     WHERE helped = TRUE AND kept_at IS NOT NULL AND taken_by_user_id IS NOT NULL
       AND (kept_at AT TIME ZONE 'UTC')::date >= $1::date
  ),
  daily AS (SELECT user_id, day, SUM(m) AS minutes FROM minutes GROUP BY user_id, day)`;

export type DaysWon = { total: number; thisWeek: number };

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function readDaysWon(now = new Date()): Promise<DaysWon> {
  const weekStart = new Date(now.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
  const result = await queryDb<{ total: string | null; week: string | null }>(
    `WITH ${DAILY_MINUTES_CTE}
     SELECT SUM(minutes)::text AS total, SUM(minutes) FILTER (WHERE day >= $2::date)::text AS week FROM daily`,
    ['2000-01-01', weekStart],
  );
  const row = result.rows[0];
  return {
    total: round1(Number(row?.total ?? 0) / ACTION_MINUTES_PER_DAY_WON),
    thisWeek: round1(Number(row?.week ?? 0) / ACTION_MINUTES_PER_DAY_WON),
  };
}

// Retention, measured from sign-up (a member's first sign-in):
// - Retained: one day with 30 or more action minutes in the last 4 weeks (target 20%), among members
//   who signed up at least 4 weeks ago.
// - Came back: signed in this week after two or more weeks away.
// - Every day: 30 action minutes on each of the last 7 days.
export type Retention = { eligible: number; retained: number; retainedShare: number; cameBack: number; everyDay: number };

export async function readRetention(now = new Date()): Promise<Retention> {
  const day = (offset: number) => new Date(now.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
  const result = await queryDb<{ eligible: number; retained: number; came_back: number; every_day: number }>(
    `WITH ${DAILY_MINUTES_CTE},
     firsts AS (SELECT user_id, MIN(created_at) AS first_seen FROM login_events GROUP BY user_id),
     eligible AS (SELECT user_id FROM firsts WHERE first_seen < $1::date),
     full_days AS (SELECT user_id, day FROM daily WHERE minutes >= 30),
     recent AS (SELECT DISTINCT user_id FROM login_events WHERE created_at >= $2::date),
     earlier AS (
       SELECT user_id, MAX(created_at) AS last_before FROM login_events WHERE created_at < $2::date GROUP BY user_id
     )
     SELECT
       (SELECT COUNT(*) FROM eligible)::int AS eligible,
       (SELECT COUNT(DISTINCT e.user_id) FROM eligible e JOIN full_days f ON f.user_id = e.user_id)::int AS retained,
       (SELECT COUNT(*) FROM recent r JOIN earlier b ON b.user_id = r.user_id WHERE b.last_before < $3::date)::int AS came_back,
       (SELECT COUNT(*) FROM (SELECT user_id FROM full_days WHERE day >= $2::date GROUP BY user_id HAVING COUNT(*) >= 7) s)::int AS every_day`,
    [day(28), day(6), day(20)],
  );
  return toRetention(result.rows[0] ?? { eligible: 0, retained: 0, came_back: 0, every_day: 0 });
}

function toRetention(row: { eligible: number; retained: number; came_back: number; every_day: number }): Retention {
  return {
    eligible: row.eligible,
    retained: row.retained,
    retainedShare: row.eligible > 0 ? Math.round((row.retained / row.eligible) * 1000) / 10 : 0,
    cameBack: row.came_back,
    everyDay: row.every_day,
  };
}

// Time to unlock, over members who sent their address in the last 90 days: median days from their
// first sign-in to sending it, and from sending it to approval.
export type TimeToUnlock = { sent: number; daysToSend: number | null; approved: number; daysToApprove: number | null };

export async function readTimeToUnlock(now = new Date()): Promise<TimeToUnlock> {
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const result = await queryDb<{ sent: number; to_send: string | null; approved: number; to_approve: string | null }>(
    `WITH firsts AS (SELECT user_id, MIN(created_at) AS first_seen FROM login_events GROUP BY user_id),
     subs AS (
       SELECT s.user_id, s.created_at, s.reviewed_at, s.access_tier, f.first_seen
         FROM unlock_verification_submissions s LEFT JOIN firsts f ON f.user_id = s.user_id
        WHERE s.created_at >= $1::timestamptz
     )
     SELECT
       COUNT(*)::int AS sent,
       (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (created_at - first_seen)) / 86400.0)
         FILTER (WHERE first_seen IS NOT NULL AND created_at >= first_seen))::text AS to_send,
       (COUNT(*) FILTER (WHERE access_tier = 'approved_full' AND reviewed_at IS NOT NULL))::int AS approved,
       (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 86400.0)
         FILTER (WHERE access_tier = 'approved_full' AND reviewed_at IS NOT NULL))::text AS to_approve
     FROM subs`,
    [since],
  );
  const row = result.rows[0];
  const days = (value: string | null | undefined) => (value === null || value === undefined ? null : round1(Number(value)));
  return { sent: row?.sent ?? 0, daysToSend: days(row?.to_send), approved: row?.approved ?? 0, daysToApprove: days(row?.to_approve) };
}
