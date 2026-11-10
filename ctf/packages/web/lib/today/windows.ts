import { queryDb } from 'lib/db/postgres';
import type { TodayCardWindow } from './lifetime';

// The store behind how long an ask or offer stays on Today (today_card_windows), one row per card
// id, written only once its poster set something: a deadline, a renew, or a close with its outcome.
// Every query is parameterized.

type WindowRow = { card_id: string; owner_user_id: string; due_at: Date | null; shown_until: Date | null; outcome: 'done' | 'not_done' | null };

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

export async function readWindows(cardIds: readonly string[]): Promise<Map<string, TodayCardWindow>> {
  if (cardIds.length === 0) return new Map();
  const result = await queryDb<WindowRow>(
    `SELECT card_id, owner_user_id, due_at, shown_until, outcome FROM today_card_windows WHERE card_id = ANY($1::text[])`,
    [cardIds],
  );
  return new Map(
    result.rows.map((row) => [
      row.card_id,
      { ownerUserId: row.owner_user_id, dueIso: iso(row.due_at), shownUntilIso: iso(row.shown_until), outcome: row.outcome },
    ]),
  );
}

// The deadline chosen when the ask was posted. Written again on a repeated post with the same key.
export async function setDue(cardId: string, ownerUserId: string, dueIso: string): Promise<void> {
  await queryDb(
    `INSERT INTO today_card_windows (card_id, owner_user_id, due_at) VALUES ($1, $2, $3::timestamptz)
     ON CONFLICT (card_id) DO UPDATE SET due_at = EXCLUDED.due_at, updated_at = NOW()
     WHERE today_card_windows.owner_user_id = EXCLUDED.owner_user_id`,
    [cardId, ownerUserId, dueIso],
  );
}

// Keep the card up until `until` (14 days from the tap). Only its poster's row is changed.
export async function renewWindow(cardId: string, ownerUserId: string, until: Date): Promise<void> {
  await queryDb(
    `INSERT INTO today_card_windows (card_id, owner_user_id, shown_until, renewed_at) VALUES ($1, $2, $3::timestamptz, NOW())
     ON CONFLICT (card_id) DO UPDATE SET shown_until = EXCLUDED.shown_until, renewed_at = NOW(), updated_at = NOW()
     WHERE today_card_windows.owner_user_id = EXCLUDED.owner_user_id`,
    [cardId, ownerUserId, until.toISOString()],
  );
}

// The outcome the poster picked when they closed the ask from Today.
export async function recordOutcome(cardId: string, ownerUserId: string, outcome: 'done' | 'not_done'): Promise<void> {
  await queryDb(
    `INSERT INTO today_card_windows (card_id, owner_user_id, outcome, closed_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (card_id) DO UPDATE SET outcome = EXCLUDED.outcome, closed_at = NOW(), updated_at = NOW()
     WHERE today_card_windows.owner_user_id = EXCLUDED.owner_user_id`,
    [cardId, ownerUserId, outcome],
  );
}
