import { queryDb } from 'lib/db/postgres';

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

  // ON CONFLICT against the (user_id, UTC-day) unique index makes the once-per-day dedupe
  // atomic at the database level, so concurrent requests/instances cannot write two rows for
  // the same member on the same UTC day. The in-memory marker above just spares the database
  // from repeated no-op inserts; correctness does not depend on it.
  void queryDb(
    `INSERT INTO login_events (user_id, created_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id, ((created_at AT TIME ZONE 'UTC')::date)) DO NOTHING`,
    [trimmed],
  ).catch(() => {
    // Let a later request try again rather than silently never recording this member.
    // Guarded on the day so a failure that resolves after a UTC-day rollover does not
    // clear a marker that now belongs to the new day.
    if (recordedToday.day === today) {
      recordedToday.seen.delete(trimmed);
    }
  });
}

export async function getActiveUserIdsLastDays(days: number): Promise<string[]> {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
  const result = await queryDb<{ user_id: string }>(
    `SELECT DISTINCT user_id
     FROM login_events
     WHERE created_at >= NOW() - make_interval(days => $1::int)
     ORDER BY user_id ASC`,
    [safeDays],
  );

  return result.rows.map((row) => row.user_id);
}

export async function countActiveUsersLastDays(days: number): Promise<number> {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
  const result = await queryDb<{ total: string }>(
    `SELECT COUNT(DISTINCT user_id)::text AS total
     FROM login_events
     WHERE created_at >= NOW() - make_interval(days => $1::int)`,
    [safeDays],
  );

  return Number.parseInt(result.rows[0]?.total ?? '0', 10);
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
