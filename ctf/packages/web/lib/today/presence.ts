import { SE_PRESENCE_WINDOW_MINUTES } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// "N Avens here" on Today: a member's last Today read (member_presence), touched at most once a minute
// per member, and the number of members whose last read was in the last 10 minutes. Counted with one
// COUNT and never listed: no name, id or time leaves this file.

const TOUCH_EVERY_MS = 60_000;
// Skips the write when this server already touched the member within the minute. The database keeps
// the same limit for reads that land on another server.
const touchedAt = new Map<string, number>();

export async function touchPresence(accountId: string, now = Date.now()): Promise<void> {
  const last = touchedAt.get(accountId);
  if (last !== undefined && now - last < TOUCH_EVERY_MS) return;
  touchedAt.set(accountId, now);
  if (touchedAt.size > 10_000) touchedAt.clear();
  await queryDb(
    `INSERT INTO member_presence (account_id, last_seen_at) VALUES ($1, NOW())
     ON CONFLICT (account_id) DO UPDATE SET last_seen_at = NOW()
     WHERE member_presence.last_seen_at < NOW() - INTERVAL '1 minute'`,
    [accountId],
  );
}

export async function countPresence(): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM member_presence WHERE last_seen_at > NOW() - make_interval(mins => $1)`,
    [SE_PRESENCE_WINDOW_MINUTES],
  );
  return Number(result.rows[0]?.count ?? 0);
}

// Touch, then count, so the reader is always among those counted. Either failing throws; Today then
// hides the pill.
export async function readPresence(accountId: string): Promise<number> {
  await touchPresence(accountId);
  return countPresence();
}
