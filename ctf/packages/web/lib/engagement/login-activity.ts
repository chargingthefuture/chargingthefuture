import { queryDb } from 'lib/db/postgres';

export async function getActiveUserIdsLastDays(days: number): Promise<string[]> {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
  const result = await queryDb<{ user_id: string }>(
    `SELECT DISTINCT user_id
     FROM login_events
     WHERE created_at >= NOW() - ($1::text || ' days')::interval
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
     WHERE created_at >= NOW() - ($1::text || ' days')::interval`,
    [safeDays],
  );

  return Number.parseInt(result.rows[0]?.total ?? '0', 10);
}

// Total people signed up — the headline "Members" figure. Prefer the Clerk-mirrored `users`
// identity table (one row per account), which is the true signup count. Environments built only
// from the canonical schema.sql have no `users` table, so fall back to the count of distinct
// authenticated users seen in login_events. Returns null only if neither source can be read.
export async function countTotalMembers(): Promise<number | null> {
  const usersTable = await queryDb<{ reg: string | null }>(
    `SELECT to_regclass('public.users')::text AS reg`,
  );

  if (usersTable.rows[0]?.reg) {
    const result = await queryDb<{ total: string }>(`SELECT COUNT(*)::text AS total FROM users`);
    return Number.parseInt(result.rows[0]?.total ?? '0', 10);
  }

  const fallback = await queryDb<{ total: string }>(
    `SELECT COUNT(DISTINCT user_id)::text AS total FROM login_events`,
  );
  return Number.parseInt(fallback.rows[0]?.total ?? '0', 10);
}
