import { seCardItemRef } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';
import { DAILY_CREDIT_LOG_PAGE_SIZE, type DailyCreditCardRecord, type DailyCreditHelpAnswer } from './audit-summary';

// Reads behind the admin daily credit audit log. Read-only and parameterized. Every row is shown,
// closed or not: an admin list hides nothing.

type CardRow = {
  day: string;
  card_id: string;
  author_user_id: string;
  chosen_at: string;
  helper_user_id: string | null;
  confirmed_at: string | null;
  credit_status: 'held' | 'granted' | null;
  granted_at: string | null;
};

type AnswerRow = { plugin: string; item_id: string; account_id: string; created_at: string };

const CARD_COLUMNS = `to_char(day, 'YYYY-MM-DD') AS day, card_id, author_user_id, chosen_at::text AS chosen_at,
  helper_user_id, confirmed_at::text AS confirmed_at, credit_status, granted_at::text AS granted_at`;

const refKey = (plugin: string, itemId: string) => `${plugin}\u0000${itemId}`;

// Every "I can help" answer on these cards, oldest first, keyed by card id.
async function readHelpAnswers(rows: CardRow[]): Promise<Map<string, DailyCreditHelpAnswer[]>> {
  const byRef = new Map<string, string>();
  for (const row of rows) {
    const ref = seCardItemRef(row.card_id);
    byRef.set(refKey(ref.plugin, ref.itemId), row.card_id);
  }
  const answers = new Map<string, DailyCreditHelpAnswer[]>();
  if (byRef.size === 0) return answers;
  const plugins: string[] = [];
  const itemIds: string[] = [];
  for (const key of byRef.keys()) {
    const [plugin, itemId] = key.split('\u0000');
    plugins.push(plugin);
    itemIds.push(itemId);
  }
  const result = await queryDb<AnswerRow>(
    `SELECT plugin, item_id, account_id, created_at::text AS created_at FROM commons_item_answers
      WHERE kind = 'help' AND (plugin, item_id) IN (SELECT * FROM unnest($1::text[], $2::text[]))
      ORDER BY created_at, account_id`,
    [plugins, itemIds],
  );
  for (const answer of result.rows) {
    const cardId = byRef.get(refKey(answer.plugin, answer.item_id));
    if (!cardId) continue;
    const list = answers.get(cardId) ?? [];
    list.push({ userId: answer.account_id, answeredAt: answer.created_at });
    answers.set(cardId, list);
  }
  return answers;
}

async function withAnswers(rows: CardRow[]): Promise<DailyCreditCardRecord[]> {
  const answers = await readHelpAnswers(rows);
  return rows.map((row) => ({
    day: row.day,
    cardId: row.card_id,
    askerUserId: row.author_user_id,
    chosenAt: row.chosen_at,
    // The asker cannot help on their own ask, so an answer of theirs is left out.
    helpers: (answers.get(row.card_id) ?? []).filter((answer) => answer.userId !== row.author_user_id),
    pickedUserId: row.helper_user_id,
    confirmedAt: row.confirmed_at,
    creditStatus: row.credit_status,
    grantedAt: row.granted_at,
  }));
}

export async function countDailyCreditCards(): Promise<number> {
  const result = await queryDb<{ total: string }>(`SELECT COUNT(*)::text AS total FROM today_daily_credit_cards`, []);
  return Number(result.rows[0]?.total ?? 0);
}

/** One page of every day's credit card, newest day first. */
export async function listDailyCreditCardsPage(page: number): Promise<DailyCreditCardRecord[]> {
  const result = await queryDb<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM today_daily_credit_cards ORDER BY day DESC LIMIT $1 OFFSET $2`,
    [DAILY_CREDIT_LOG_PAGE_SIZE, (page - 1) * DAILY_CREDIT_LOG_PAGE_SIZE],
  );
  return withAnswers(result.rows);
}

/** Every card with a picked helper: one row a day at most, so the summaries read them all. */
export async function listClosedDailyCreditCards(): Promise<DailyCreditCardRecord[]> {
  const result = await queryDb<CardRow>(
    `SELECT ${CARD_COLUMNS} FROM today_daily_credit_cards WHERE helper_user_id IS NOT NULL ORDER BY day DESC`,
    [],
  );
  return withAnswers(result.rows);
}
