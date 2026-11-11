import { SE_SAVES_MAX, type SeCardKind, type SeSaveChange, type SeSavedCard } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// The store behind a member's Save for later list (today_card_saves), one row per member per card.
// Every query is parameterized and scoped to one account.

type SaveRow = { card_id: string; kind: SeCardKind; title: string; href: string; saved_at: Date };

export async function listSaves(accountId: string): Promise<SeSavedCard[]> {
  const result = await queryDb<SaveRow>(
    `SELECT card_id, kind, title, href, saved_at FROM today_card_saves WHERE account_id = $1 ORDER BY saved_at DESC LIMIT $2`,
    [accountId, SE_SAVES_MAX],
  );
  return result.rows.map((row) => ({ cardId: row.card_id, kind: row.kind, title: row.title, href: row.href, savedAtIso: new Date(row.saved_at).toISOString() }));
}

// Which of these cards the member saved, for the Save button's state on Today.
export async function readSavedIds(accountId: string, cardIds: readonly string[]): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();
  const result = await queryDb<{ card_id: string }>(`SELECT card_id FROM today_card_saves WHERE account_id = $1 AND card_id = ANY($2::text[])`, [
    accountId,
    cardIds,
  ]);
  return new Set(result.rows.map((row) => row.card_id));
}

// Save (saving again keeps the first time) or take off the list. 'full' when the list already holds
// SE_SAVES_MAX cards and this one is not among them.
export async function saveChange(accountId: string, change: SeSaveChange): Promise<'saved' | 'removed' | 'full'> {
  if (!change.saved) {
    await queryDb(`DELETE FROM today_card_saves WHERE account_id = $1 AND card_id = $2`, [accountId, change.cardId]);
    return 'removed';
  }
  const result = await queryDb(
    `INSERT INTO today_card_saves (account_id, card_id, kind, title, href)
     SELECT $1, $2, $3, $4, $5
     WHERE (SELECT COUNT(*) FROM today_card_saves WHERE account_id = $1 AND card_id <> $2) < $6
     ON CONFLICT (account_id, card_id) DO UPDATE SET title = EXCLUDED.title, href = EXCLUDED.href`,
    [accountId, change.cardId, change.kind, change.title, change.href, SE_SAVES_MAX],
  );
  return (result.rowCount ?? 0) > 0 ? 'saved' : 'full';
}
