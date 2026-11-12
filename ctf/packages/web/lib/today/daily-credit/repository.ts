import { seCardItemRef } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// The store behind the day's credit card (today_daily_credit_cards, one row per UTC day). Every
// query is parameterized. ServiceCredits are an internal credits unit, not money.

export type DailyCreditDay = { day: string; cardId: string; authorUserId: string };

type DayRow = { day: string; card_id: string; author_user_id: string };

const toDay = (row: DayRow): DailyCreditDay => ({ day: row.day, cardId: row.card_id, authorUserId: row.author_user_id });

export async function readDailyCreditDay(day: string): Promise<DailyCreditDay | null> {
  const result = await queryDb<DayRow>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, card_id, author_user_id FROM today_daily_credit_cards WHERE day = $1::date`,
    [day],
  );
  return result.rows[0] ? toDay(result.rows[0]) : null;
}

// The first read of the day records the choice; a read racing it keeps whichever landed first, so the
// card is the same for everyone.
export async function chooseDailyCreditDay(day: string, cardId: string, authorUserId: string): Promise<DailyCreditDay | null> {
  await queryDb(
    `INSERT INTO today_daily_credit_cards (day, card_id, author_user_id) VALUES ($1::date, $2, $3)
     ON CONFLICT (day) DO NOTHING`,
    [day, cardId, authorUserId],
  );
  return readDailyCreditDay(day);
}

// Stamp the helper on the card's earliest day, once: only while no helper is stamped there, and only
// for the asker who posted it. Returns the day, or null when the card never carried the credit, was
// already confirmed, or is somebody else's. Stamped before any credit is created, so two confirms at
// once cannot both create one.
export async function stampDailyCreditHelper(input: {
  cardId: string;
  askerUserId: string;
  helperUserId: string;
  status: 'held' | 'granted';
}): Promise<string | null> {
  const result = await queryDb<{ day: string }>(
    `UPDATE today_daily_credit_cards SET helper_user_id = $3, confirmed_at = NOW(), credit_status = $4
      WHERE day = (SELECT MIN(day) FROM today_daily_credit_cards WHERE card_id = $1)
        AND card_id = $1 AND author_user_id = $2 AND helper_user_id IS NULL
      RETURNING to_char(day, 'YYYY-MM-DD') AS day`,
    [input.cardId, input.askerUserId, input.helperUserId, input.status],
  );
  return result.rows[0]?.day ?? null;
}

export async function markDailyCreditGranted(day: string, governanceEventId: string | null): Promise<void> {
  await queryDb(
    `UPDATE today_daily_credit_cards SET credit_status = 'granted', granted_at = NOW(), governance_event_id = $2 WHERE day = $1::date`,
    [day, governanceEventId],
  );
}

// A grant that failed goes back to held, so the helper's next Unlock approval run tries it again.
export async function markDailyCreditHeld(day: string): Promise<void> {
  await queryDb(`UPDATE today_daily_credit_cards SET credit_status = 'held' WHERE day = $1::date AND credit_status = 'granted' AND granted_at IS NULL`, [day]);
}

export type HeldDailyCredit = { day: string; cardId: string; authorUserId: string };

export async function listHeldDailyCredits(helperUserId: string): Promise<HeldDailyCredit[]> {
  const result = await queryDb<DayRow>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, card_id, author_user_id FROM today_daily_credit_cards
      WHERE helper_user_id = $1 AND credit_status = 'held' ORDER BY day`,
    [helperUserId],
  );
  return result.rows.map(toDay);
}

// Moves a held row to granted only while it is still held, so two approval runs cannot both create.
export async function claimHeldDailyCredit(day: string, helperUserId: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE today_daily_credit_cards SET credit_status = 'granted' WHERE day = $1::date AND helper_user_id = $2 AND credit_status = 'held'`,
    [day, helperUserId],
  );
  return (result.rowCount ?? 0) > 0;
}

// The member who helped on a card closed from Today: the first other member who answered "I can
// help" on it. Null when nobody did.
export async function firstHelperOn(cardId: string, askerUserId: string): Promise<string | null> {
  const ref = seCardItemRef(cardId);
  const result = await queryDb<{ account_id: string }>(
    `SELECT account_id FROM commons_item_answers
      WHERE plugin = $1 AND item_id = $2 AND kind = 'help' AND account_id <> $3
      ORDER BY created_at LIMIT 1`,
    [ref.plugin, ref.itemId, askerUserId],
  );
  return result.rows[0]?.account_id ?? null;
}
