import { queryDb } from 'lib/db/postgres';
import { countActiveMembersLastDays, listActiveMemberIdsLastDays } from 'lib/engagement/member-activity';
import { failureReason } from 'lib/errors/failure';

// Per-instance memory of who we already recorded today (UTC), so a signed-in
// member browsing the app does not write a `login_events` row on every request.
// The DB insert below is also guarded, so correctness does not depend on this
// cache — it only spares the database from repeated no-op writes. Only the
// current day's set is kept: when the UTC day rolls over the set is cleared,
// so the cache is bounded by the number of members active today rather than
// growing by one entry per member ever seen over the process lifetime.
const recordedToday = { day: '', seen: new Set<string>() };

function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// Record that a member was active today. This is the writer for the `login_events`
// table — the single dedicated table that the active-user / daily-active-member
// signals read from (used by PeerProgramming cohort assignment and the Weekly
// Performance review). It is deliberately deduplicated to at most one row per
// member per UTC day: that keeps the table to a daily activity signal rather than
// a full request log, and is all the 7-day "active members" window needs.
//
// Fire-and-forget by design — call sites do not await it, and a failure here must
// never break the request. We only drop the in-memory marker on failure so a
// later request retries the write.
export function recordLoginEvent(userId: string): void {
  const trimmed = userId.trim();
  if (trimmed.length === 0) {
    return;
  }

  const today = utcDayKey();
  if (recordedToday.day !== today) {
    recordedToday.day = today;
    recordedToday.seen.clear();
  }
  if (recordedToday.seen.has(trimmed)) {
    return;
  }
  recordedToday.seen.add(trimmed);

  // Once per member per UTC day, two ways over. The `WHERE NOT EXISTS` guard is the one that
  // always applies: it holds on any database, including one where the (user_id, UTC-day) unique
  // index was never built. The bare `ON CONFLICT DO NOTHING` closes the race between two
  // concurrent requests wherever that index does exist. It is deliberately bare rather than
  // naming the index expression: an inference target that matches no index raises `42P10` and
  // fails the insert outright, which is exactly how a database with a stalled index build used to
  // end up recording nobody at all. The in-memory marker above only spares the database repeated
  // no-op inserts; correctness does not depend on it.
  void queryDb(
    `INSERT INTO login_events (user_id, created_at)
     SELECT $1, NOW()
     WHERE NOT EXISTS (
       SELECT 1 FROM login_events
       WHERE user_id = $1
         AND (created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date
     )
     ON CONFLICT DO NOTHING`,
    [trimmed],
  ).catch((error: unknown) => {
    // Say what failed and why (rule 137). This write used to fail in silence, and a silent failure
    // here does not look like a failure — it looks like a quiet week, which is the harder thing to
    // notice. The member id is not logged: the failure is what an operator needs, not who.
    console.error(
      `[engagement.login-activity] could not record a member-day in login_events; the active-member readings will undercount until this succeeds: ${failureReason(error)}`,
    );
    // Let a later request try again rather than silently never recording this member.
    // Guarded on the day so a failure that resolves after a UTC-day rollover does not
    // clear a marker that now belongs to the new day.
    if (recordedToday.day === today) {
      recordedToday.seen.delete(trimmed);
    }
  });
}

// Both readers below answer "who has been active lately", and both go through the shared member-day
// set in lib/engagement/member-activity.ts, which counts the sign-in record above and nothing else
// (owner decision, 2026-08-27). Keeping the two on one definition stops the dashboard and the cohort
// run from disagreeing about who turned up. It also means the write above is load-bearing: a member
// whose row never lands is missing from both, which is why its failure is logged rather than
// swallowed.

export async function getActiveUserIdsLastDays(days: number): Promise<string[]> {
  return listActiveMemberIdsLastDays(days);
}

export async function countActiveUsersLastDays(days: number): Promise<number> {
  return countActiveMembersLastDays(days);
}

// Whether the `users` table exists, probed once per process. The table is created (or not) at
// deploy time and never appears or disappears while the process runs, so the probe does not need
// to repeat on every call. Left null until the first successful probe so a transient query
// failure is retried on the next call.
let usersTableExists: boolean | null = null;

// Total people signed up — the headline "Members" figure. Prefer the Clerk-mirrored `users`
// identity table (one row per account), which is the true signup count. Environments built only
// from the canonical schema.sql have no `users` table, so fall back to the count of distinct
// authenticated users seen in login_events. Returns null only if neither source can be read.
export async function countTotalMembers(): Promise<number | null> {
  if (usersTableExists === null) {
    const usersTable = await queryDb<{ reg: string | null }>(
      `SELECT to_regclass('public.users')::text AS reg`,
    );
    usersTableExists = Boolean(usersTable.rows[0]?.reg);
    if (!usersTableExists) {
      // Expected only in schema.sql-only environments. In production this means the Clerk
      // mirror is missing and the member count is degraded to distinct login_events users,
      // which undercounts signups — log so an operator can spot the misconfiguration.
      console.error(
        '[engagement.login-activity] users table not found; countTotalMembers is using the login_events fallback, which undercounts total signups',
      );
    }
  }

  if (usersTableExists) {
    const result = await queryDb<{ total: string }>(`SELECT COUNT(*)::text AS total FROM users`);
    return Number.parseInt(result.rows[0]?.total ?? '0', 10);
  }

  const fallback = await queryDb<{ total: string }>(
    `SELECT COUNT(DISTINCT user_id)::text AS total FROM login_events`,
  );
  return Number.parseInt(fallback.rows[0]?.total ?? '0', 10);
}
