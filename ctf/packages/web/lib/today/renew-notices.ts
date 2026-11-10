import { queryDb } from 'lib/db/postgres';
import { renewNoticeDue, windowEndMs, type TodayCardWindow } from './lifetime';
import { sendRenewNotice } from './renew-notice';

// The daily run behind the day-14 notice (owner decision, 2026-11-10): every open ask and offer with no
// deadline whose 14 days end within a day, or ended in the past week, gets its poster's notice, whether
// or not they open the app. Called once a day by POST /api/internal/today/renew-notices
// (today-renew-notices.yml). The notice is keyed by card and window end, so a repeat run, or the
// poster's own Today read, never sends one twice for the same window. Reads only open items and
// their Today window rows; returns counts, never names.

const PER_SOURCE = 2000;

type Source = { source: string; href: string; sql: string };

// Each item with when its window starts (as the Today card dates it) and its Today row, if any. Only
// items that could be due: started in the last 22 days, or kept up by a renew.
const SOURCES: Source[] = [
  { source: 'socket-relay', href: '/apps/socket-relay', sql: `SELECT id::text AS id, owner_user_id AS owner, title, created_at AS start FROM socket_relay_requests WHERE status = 'open'` },
  { source: 'trust-transport', href: '/apps/trust-transport', sql: `SELECT id::text AS id, requester_user_id AS owner, 'A ride is wanted' AS title, created_at AS start FROM trust_transport_requests WHERE status = 'open'` },
  { source: 'peer-programming', href: '/apps/peer-programming', sql: `SELECT id::text AS id, owner_user_id AS owner, title, created_at AS start FROM peer_programming_goals WHERE status = 'open'` },
  { source: 'lighthouse', href: '/apps/lighthouse', sql: `SELECT id::text AS id, host_user_id AS owner, title, updated_at AS start FROM lighthouse_properties WHERE is_active = TRUE` },
];

type Row = { id: string; owner: string; title: string; start: Date; due_at: Date | null; shown_until: Date | null; outcome: 'done' | 'not_done' | null };

async function candidates(source: Source): Promise<Row[]> {
  const result = await queryDb<Row>(
    `SELECT item.id, item.owner, item.title, item.start, w.due_at, w.shown_until, w.outcome
       FROM (${source.sql}) AS item
       LEFT JOIN today_card_windows w ON w.card_id = $1 || ':' || item.id
      WHERE w.due_at IS NULL AND w.outcome IS NULL
        AND (item.start > NOW() - INTERVAL '22 days' OR w.shown_until > NOW() - INTERVAL '8 days')
      LIMIT ${PER_SOURCE}`,
    [source.source],
  );
  return result.rows;
}

function windowOf(row: Row): TodayCardWindow {
  const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
  return { ownerUserId: row.owner, dueIso: iso(row.due_at), shownUntilIso: iso(row.shown_until), outcome: row.outcome };
}

export type RenewNoticeRun = { checked: number; due: number };

export async function sendDueRenewNotices(now = new Date()): Promise<RenewNoticeRun> {
  let checked = 0;
  let due = 0;
  for (const source of SOURCES) {
    const rows = await candidates(source);
    checked += rows.length;
    for (const row of rows) {
      const card = { source: source.source, createdAtIso: new Date(row.start).toISOString() };
      const window = windowOf(row);
      if (!renewNoticeDue(card, window, now)) continue;
      due += 1;
      await sendRenewNotice({
        ownerUserId: row.owner,
        cardId: `${source.source}:${row.id}`,
        source: source.source,
        title: row.title,
        href: source.href,
        windowEndMs: windowEndMs(card, window),
      });
    }
  }
  return { checked, due };
}
