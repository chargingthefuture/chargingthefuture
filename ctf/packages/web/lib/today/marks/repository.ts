import type { SeCardMark, SeCardMarkChange } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// The store behind a member's own Done and Not for me marks (today_card_marks), one row per member
// per card. Every query is parameterized and scoped to one account.

type MarkRow = { card_id: string; mark: 'done' | 'not_for_me'; marked_at: Date };

export async function readCardMarks(accountId: string, cardIds: readonly string[]): Promise<SeCardMark[]> {
  if (cardIds.length === 0) return [];
  const result = await queryDb<MarkRow>(
    `SELECT card_id, mark, marked_at FROM today_card_marks WHERE account_id = $1 AND card_id = ANY($2::text[])`,
    [accountId, cardIds],
  );
  return result.rows.map((row) => ({ cardId: row.card_id, mark: row.mark, markedAtIso: new Date(row.marked_at).toISOString() }));
}

// One change from the screen: a mark set now (replacing the card's earlier one), or Done taken away.
// With `keepExisting` (the one-time upload of a device's old marks) a card the account already marked
// keeps its mark.
export async function saveCardMarks(accountId: string, changes: readonly SeCardMarkChange[], keepExisting = false): Promise<void> {
  const cleared = changes.filter((change) => change.mark === 'clear').map((change) => change.cardId);
  const set = changes.filter((change) => change.mark !== 'clear');
  if (cleared.length > 0) {
    await queryDb(`DELETE FROM today_card_marks WHERE account_id = $1 AND card_id = ANY($2::text[]) AND mark = 'done'`, [accountId, cleared]);
  }
  if (set.length === 0) return;
  const conflict = keepExisting ? 'DO NOTHING' : 'DO UPDATE SET mark = EXCLUDED.mark, marked_at = NOW()';
  await queryDb(
    `INSERT INTO today_card_marks (account_id, card_id, mark)
     SELECT $1, card_id, mark FROM UNNEST($2::text[], $3::text[]) AS input(card_id, mark)
     ON CONFLICT (account_id, card_id) ${conflict}`,
    [accountId, set.map((change) => change.cardId), set.map((change) => change.mark)],
  );
}

// The card ids this member gave one mark, newest first (Me → Read and Hidden).
export async function listMarkedCardIds(accountId: string, mark: 'done' | 'not_for_me', limit = 200): Promise<string[]> {
  const result = await queryDb<{ card_id: string }>(
    `SELECT card_id FROM today_card_marks WHERE account_id = $1 AND mark = $2 ORDER BY marked_at DESC LIMIT $3`,
    [accountId, mark, limit],
  );
  return result.rows.map((row) => row.card_id);
}
