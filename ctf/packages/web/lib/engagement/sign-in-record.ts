import { queryDb } from 'lib/db/postgres';
import {
  MEMBER_ACTIVITY_TABLE,
  countActiveMembersInWeek,
  countMemberDaysInWeek,
  elapsedDaysInWeek,
} from 'lib/engagement/member-activity';
import { currentWeekStart } from 'lib/weekly-performance/live-metrics';

// The sign-in record, read as a health check for the admin Sign-in record screen.
//
// Active Members and Daily Active Members on the Weekly Performance dashboard count `login_events`
// and nothing else (owner decision, 2026-08-27). When those rows read zero, the question is never
// "is the definition wrong" but "is the record being written", and until this existed the only
// ways to answer it were the server log, which nobody reads, and SQL pasted into the Neon
// dashboard. This module answers it from the database: what the record holds, day by day for the
// last two weeks, the current week exactly as the dashboard computes it, and whether the one
// constraint that ever blocked the write (the v2 foreign key to `users`) is still there.
//
// Aggregate only. No member id is returned except the caller's own recorded-today flag, which is
// the caller looking at their own row. Every table and column name is a fixed literal.

export type SignInRecordDay = { day: string; members: number };

export type SignInRecordWeek = {
  weekStart: string;
  memberDays: number;
  activeMembers: number;
  elapsedDays: number;
  dailyActiveMembers: number;
};

export type SignInRecordHealth = {
  readAt: string;
  totalRows: number;
  totalMembers: number;
  firstRowAt: string | null;
  lastRowAt: string | null;
  rowsToday: number;
  membersToday: number;
  // Whether the caller's own row for today (UTC) exists, read after the self-write.
  selfRecordedToday: boolean;
  selfRecordedAt: string | null;
  // The v2 constraint that refused every member the `users` mirror did not hold. Dropped by
  // post/0034; if it is back, the write is refused again for every newer member.
  usersForeignKeyPresent: boolean;
  currentWeek: SignInRecordWeek;
  // Distinct members per UTC day, most recent first, the last fourteen days including today. A
  // day with no rows is listed as 0 so a gap reads as a gap.
  days: SignInRecordDay[];
};

type Totals = Pick<SignInRecordHealth, 'totalRows' | 'totalMembers' | 'firstRowAt' | 'lastRowAt'>;
type Today = Pick<SignInRecordHealth, 'rowsToday' | 'membersToday'>;

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// One query per fact, each returning its own parsed shape, so the assembly at the bottom is a
// plain object literal and every reading here is one statement a reader can check on its own.

async function readTotals(): Promise<Totals> {
  const result = await queryDb<{ total_rows: string; total_members: string; first_row: Date | null; last_row: Date | null }>(
    `SELECT COUNT(*)::text AS total_rows,
            COUNT(DISTINCT user_id) FILTER (WHERE btrim(user_id) <> '')::text AS total_members,
            MIN(created_at) AS first_row,
            MAX(created_at) AS last_row
     FROM ${MEMBER_ACTIVITY_TABLE}`,
  );
  const row = result.rows[0];
  return {
    totalRows: Number(row?.total_rows ?? 0),
    totalMembers: Number(row?.total_members ?? 0),
    firstRowAt: toIso(row?.first_row),
    lastRowAt: toIso(row?.last_row),
  };
}

async function readToday(): Promise<Today> {
  const result = await queryDb<{ rows_today: string; members_today: string }>(
    `SELECT COUNT(*)::text AS rows_today,
            COUNT(DISTINCT user_id) FILTER (WHERE btrim(user_id) <> '')::text AS members_today
     FROM ${MEMBER_ACTIVITY_TABLE}
     WHERE (created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date`,
  );
  const row = result.rows[0];
  return { rowsToday: Number(row?.rows_today ?? 0), membersToday: Number(row?.members_today ?? 0) };
}

async function readSelfRecordedAt(actorUserId: string): Promise<string | null> {
  const result = await queryDb<{ recorded_at: Date | null }>(
    `SELECT MIN(created_at) AS recorded_at
     FROM ${MEMBER_ACTIVITY_TABLE}
     WHERE user_id = $1
       AND (created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date`,
    [actorUserId],
  );
  return toIso(result.rows[0]?.recorded_at);
}

async function readUsersForeignKeyPresent(): Promise<boolean> {
  const result = await queryDb<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'login_events_user_id_fkey'
         AND conrelid = to_regclass('public.${MEMBER_ACTIVITY_TABLE}')
     ) AS present`,
  );
  return result.rows[0]?.present === true;
}

// The current week exactly as the dashboard computes it: the same helpers, the same divisor.
async function readCurrentWeek(): Promise<SignInRecordWeek> {
  const weekStart = currentWeekStart();
  const [memberDays, activeMembers] = await Promise.all([
    countMemberDaysInWeek(weekStart),
    countActiveMembersInWeek(weekStart),
  ]);
  const elapsedDays = elapsedDaysInWeek(weekStart);
  return {
    weekStart,
    memberDays,
    activeMembers,
    elapsedDays,
    dailyActiveMembers: Math.round((memberDays / elapsedDays) * 100) / 100,
  };
}

async function readRecentDays(): Promise<SignInRecordDay[]> {
  const result = await queryDb<{ day: string; members: string }>(
    `WITH span AS (
       SELECT generate_series(
                (NOW() AT TIME ZONE 'UTC')::date - 13,
                (NOW() AT TIME ZONE 'UTC')::date,
                INTERVAL '1 day'
              )::date AS day
     ),
     member_days AS (
       SELECT DISTINCT user_id, (created_at AT TIME ZONE 'UTC')::date AS activity_day
       FROM ${MEMBER_ACTIVITY_TABLE}
       WHERE created_at >= NOW() - INTERVAL '15 days'
         AND user_id IS NOT NULL
         AND btrim(user_id) <> ''
     )
     SELECT span.day::text AS day, COUNT(member_days.user_id)::text AS members
     FROM span
     LEFT JOIN member_days ON member_days.activity_day = span.day
     GROUP BY span.day
     ORDER BY span.day DESC`,
  );
  return result.rows.map((row) => ({ day: row.day, members: Number(row.members) }));
}

export async function readSignInRecordHealth(actorUserId: string): Promise<SignInRecordHealth> {
  const [totals, today, selfRecordedAt, usersForeignKeyPresent, currentWeek, days] = await Promise.all([
    readTotals(),
    readToday(),
    readSelfRecordedAt(actorUserId),
    readUsersForeignKeyPresent(),
    readCurrentWeek(),
    readRecentDays(),
  ]);

  return {
    readAt: new Date().toISOString(),
    ...totals,
    ...today,
    selfRecordedToday: selfRecordedAt !== null,
    selfRecordedAt,
    usersForeignKeyPresent,
    currentWeek,
    days,
  };
}
