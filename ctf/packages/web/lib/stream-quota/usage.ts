import type { PoolClient } from 'pg';
import { withDbTransaction } from 'lib/db/postgres';
import {
  streamQuotaBandFor,
  streamVideoMinutesBudget,
  type StreamQuotaBand,
} from './constants';

// The Stream Video minute meter.
//
// Stream bills audio rooms per participant-minute: every connected person, speaking or listening,
// for every minute they stay connected. The app never had its own count of that, so the only way
// to know how much of the month was gone was the Stream dashboard. The presence heartbeats already
// carry the answer — a heartbeat is one participant saying "still here" — so each one credits the
// seconds since the previous heartbeat into one row per UTC day per surface.
//
// What this is and is not: it is the app's own estimate, good to within one heartbeat interval per
// participant per session, and it counts only the surfaces that call it (the Chyme rooms, guests,
// and Back Channel). Beacon, Foundation, and PeerProgramming video are not metered here yet. The
// Stream dashboard is the bill of record; this is the number the app can act on.

export type StreamVideoUsageSurface = {
  surface: string;
  minutes: number;
};

export type StreamVideoUsageDay = {
  dateIso: string;
  minutes: number;
};

export type StreamVideoUsageSummary = {
  // The first day of the current UTC month, and today, so the reader can place the numbers.
  monthStartIso: string;
  todayIso: string;
  daysElapsed: number;
  daysInMonth: number;
  budgetMinutes: number;
  usedMinutes: number;
  percentUsed: number;
  band: StreamQuotaBand;
  todayMinutes: number;
  // Month-to-date daily average carried to the end of the month. Not a promise; a straight line.
  projectedMonthMinutes: number;
  projectedPercent: number;
  bySurface: StreamVideoUsageSurface[];
  // The last 31 days, oldest first, with a zero row for a day with no usage so a chart or a list
  // reads without gaps.
  byDay: StreamVideoUsageDay[];
};

// Credit `seconds` of one participant's connected time to today's row for `surface`. Zero and
// negative values are dropped rather than written, so a caller can pass the result of a capped
// subtraction without checking it first.
export async function recordStreamVideoUsage(client: PoolClient, surface: string, seconds: number): Promise<void> {
  const whole = Math.floor(seconds);
  if (!Number.isFinite(whole) || whole <= 0) {
    return;
  }
  await client.query(
    `
      INSERT INTO stream_video_usage_daily (usage_date, surface, participant_seconds, updated_at)
      VALUES ((NOW() AT TIME ZONE 'UTC')::date, $1, $2, NOW())
      ON CONFLICT (usage_date, surface)
      DO UPDATE SET
        participant_seconds = stream_video_usage_daily.participant_seconds + EXCLUDED.participant_seconds,
        updated_at = NOW()
    `,
    [surface, whole],
  );
}

type UsageRow = { surface: string; seconds: string };
type DayRow = { usage_date: string; seconds: string };

function toMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function utcDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Month-to-date minutes against the budget, on the given client (so a route already inside a
// transaction can read it without opening a second one).
export async function readStreamVideoUsageSummary(client: PoolClient): Promise<StreamVideoUsageSummary> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const monthStartIso = utcDateIso(monthStart);
  const todayIso = utcDateIso(now);

  const [bySurfaceResult, byDayResult] = await Promise.all([
    client.query<UsageRow>(
      `
        SELECT surface, SUM(participant_seconds)::text AS seconds
        FROM stream_video_usage_daily
        WHERE usage_date >= $1::date
        GROUP BY surface
        ORDER BY SUM(participant_seconds) DESC
      `,
      [monthStartIso],
    ),
    client.query<DayRow>(
      `
        SELECT usage_date::text AS usage_date, SUM(participant_seconds)::text AS seconds
        FROM stream_video_usage_daily
        WHERE usage_date >= ($1::date - INTERVAL '30 days')
        GROUP BY usage_date
        ORDER BY usage_date ASC
      `,
      [todayIso],
    ),
  ]);

  const bySurface = bySurfaceResult.rows.map((row) => ({ surface: row.surface, minutes: toMinutes(Number(row.seconds)) }));
  const usedSeconds = bySurfaceResult.rows.reduce((total, row) => total + Number(row.seconds), 0);
  const usedMinutes = toMinutes(usedSeconds);

  const secondsByDay = new Map(byDayResult.rows.map((row) => [row.usage_date, Number(row.seconds)]));
  const byDay: StreamVideoUsageDay[] = [];
  for (let offset = 30; offset >= 0; offset -= 1) {
    const day = new Date(Date.UTC(year, month, now.getUTCDate() - offset));
    const dateIso = utcDateIso(day);
    byDay.push({ dateIso, minutes: toMinutes(secondsByDay.get(dateIso) ?? 0) });
  }

  const budgetMinutes = streamVideoMinutesBudget();
  const percentUsed = budgetMinutes > 0 ? (usedMinutes / budgetMinutes) * 100 : 0;
  const projectedMonthMinutes = daysElapsed > 0 ? Math.round((usedMinutes / daysElapsed) * daysInMonth) : 0;

  return {
    monthStartIso,
    todayIso,
    daysElapsed,
    daysInMonth,
    budgetMinutes,
    usedMinutes,
    percentUsed: Math.round(percentUsed * 10) / 10,
    band: streamQuotaBandFor(percentUsed),
    todayMinutes: toMinutes(secondsByDay.get(todayIso) ?? 0),
    projectedMonthMinutes,
    projectedPercent: budgetMinutes > 0 ? Math.round((projectedMonthMinutes / budgetMinutes) * 1000) / 10 : 0,
    bySurface,
    byDay,
  };
}

export async function getStreamVideoUsageSummary(): Promise<StreamVideoUsageSummary> {
  return withDbTransaction((client) => readStreamVideoUsageSummary(client));
}

// Only the band, for a hot path (a room read, a join) that needs the policy and nothing else.
export async function readStreamVideoQuotaBand(client: PoolClient): Promise<StreamQuotaBand> {
  const monthStart = new Date();
  const monthStartIso = utcDateIso(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1)));
  const result = await client.query<{ seconds: string | null }>(
    `SELECT SUM(participant_seconds)::text AS seconds FROM stream_video_usage_daily WHERE usage_date >= $1::date`,
    [monthStartIso],
  );
  const usedMinutes = toMinutes(Number(result.rows[0]?.seconds ?? 0));
  const budgetMinutes = streamVideoMinutesBudget();
  return streamQuotaBandFor(budgetMinutes > 0 ? (usedMinutes / budgetMinutes) * 100 : 0);
}
