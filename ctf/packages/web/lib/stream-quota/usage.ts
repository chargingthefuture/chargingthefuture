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
// participant per session for the Chyme surfaces (rooms, guests, Back Channel), and exact per
// participant for every other call (Beacon, Foundation, PeerProgramming), which are credited from
// Stream's participant-left webhook as people leave (see webhook-usage.ts). The Stream dashboard is
// the bill of record; this is the number the app can act on.

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
  // Every recorded day, oldest first, with a zero row for a day inside the range that has no usage
  // so a chart or a list reads without gaps. The table is never pruned, so this runs from the first
  // day the meter recorded anything (2026-09-19) to today and grows by one row a day; the screen
  // decides how much of it to show. At a year in that is 365 rows, which is a few tens of kilobytes
  // of JSON on an admin-only screen.
  byDay: StreamVideoUsageDay[];
  // The first day the meter has a row for, or today when it has none at all. Lets the screen say
  // how far back the history reaches without walking the list.
  earliestDateIso: string;
};

// Credit `seconds` of one participant's connected time to today's row for `surface`. Zero and
// negative values are dropped rather than written, so a caller can pass the result of a capped
// subtraction without checking it first.
export async function recordStreamVideoUsage(client: PoolClient, surface: string, seconds: number): Promise<void> {
  const entire = Math.floor(seconds);
  if (!Number.isFinite(entire) || entire <= 0) {
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
    [surface, entire],
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

// One entry per day from `fromIso` to `toIso` inclusive, with zero for a day that recorded nothing,
// so a list or a chart has no gap in it. Walks UTC days by adding to the day number, which rolls
// over months and years on its own.
function fillDays(fromIso: string, toIso: string, secondsByDay: Map<string, number>): StreamVideoUsageDay[] {
  const days: StreamVideoUsageDay[] = [];
  const cursor = new Date(`${fromIso}T00:00:00.000Z`);
  const last = new Date(`${toIso}T00:00:00.000Z`);
  while (cursor.getTime() <= last.getTime()) {
    const dateIso = utcDateIso(cursor);
    days.push({ dateIso, minutes: toMinutes(secondsByDay.get(dateIso) ?? 0) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
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
        GROUP BY usage_date
        ORDER BY usage_date ASC
      `,
    ),
  ]);

  const bySurface = bySurfaceResult.rows.map((row) => ({ surface: row.surface, minutes: toMinutes(Number(row.seconds)) }));
  const usedSeconds = bySurfaceResult.rows.reduce((total, row) => total + Number(row.seconds), 0);
  const usedMinutes = toMinutes(usedSeconds);

  const secondsByDay = new Map(byDayResult.rows.map((row) => [row.usage_date, Number(row.seconds)]));
  const earliestDateIso = byDayResult.rows[0]?.usage_date ?? todayIso;
  const byDay = fillDays(earliestDateIso, todayIso, secondsByDay);

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
    earliestDateIso,
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
