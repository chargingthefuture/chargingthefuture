import { seCardPair, type SeCardAnswerKind } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// The store behind card conversations (card_answers, card_messages, card_pair_requests), one for
// every Today card, keyed by the card id. Every read is for one viewer ($1): it leaves out anybody
// either side has blocked, and anybody the viewer muted, so they do not appear in what the viewer
// reads. Just us two messages are read only by the two members in the pair, and only once the
// second member agreed. Every query is parameterized.

export const MESSAGES_SHOWN = 100;
export const ANSWERS_SHOWN = 200;

export type AnswerRow = { accountId: string; kind: SeCardAnswerKind; createdAt: Date };
export type MessageRow = {
  id: string;
  authorId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  pairLow: string | null;
  pairHigh: string | null;
};
export type PairRow = { low: string; high: string; requesterId: string; agreedAt: Date | null };

// Shown to the viewer ($1): nobody blocked either way, nobody they muted.
function visibleTo(column: string): string {
  return `NOT EXISTS (SELECT 1 FROM member_blocks mb
      WHERE (mb.blocker_user_id = $1 AND mb.blocked_user_id = ${column})
         OR (mb.blocker_user_id = ${column} AND mb.blocked_user_id = $1))
    AND NOT EXISTS (SELECT 1 FROM member_mutes mm
      WHERE mm.user_id = $1 AND mm.kind = 'person' AND mm.target = ${column})`;
}

type RawMessage = { id: string; author_id: string; body: string; created_at: Date; edited_at: Date | null; pair_low: string | null; pair_high: string | null };

function toMessage(row: RawMessage): MessageRow {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: new Date(row.created_at),
    editedAt: row.edited_at ? new Date(row.edited_at) : null,
    pairLow: row.pair_low,
    pairHigh: row.pair_high,
  };
}

export async function listAnswers(viewerId: string, cardId: string): Promise<AnswerRow[]> {
  const result = await queryDb<{ account_id: string; kind: SeCardAnswerKind; created_at: Date }>(
    `SELECT account_id, kind, created_at FROM card_answers
      WHERE card_id = $2 AND (account_id = $1 OR (${visibleTo('account_id')}))
      ORDER BY created_at LIMIT ${ANSWERS_SHOWN}`,
    [viewerId, cardId],
  );
  return result.rows.map((row) => ({ accountId: row.account_id, kind: row.kind, createdAt: new Date(row.created_at) }));
}

export async function listPublicMessages(viewerId: string, cardId: string): Promise<MessageRow[]> {
  const result = await queryDb<RawMessage>(
    `SELECT id, author_id, body, created_at, edited_at, pair_low, pair_high FROM card_messages
      WHERE card_id = $2 AND pair_low IS NULL AND (author_id = $1 OR (${visibleTo('author_id')}))
      ORDER BY created_at DESC LIMIT ${MESSAGES_SHOWN}`,
    [viewerId, cardId],
  );
  return result.rows.reverse().map(toMessage);
}

// The viewer's own Just us two requests on the card, asked or agreed, with anybody they can see.
export async function listPairs(viewerId: string, cardId: string): Promise<PairRow[]> {
  const result = await queryDb<{ user_low: string; user_high: string; requester_id: string; agreed_at: Date | null }>(
    `SELECT user_low, user_high, requester_id, agreed_at FROM (
       SELECT *, CASE WHEN user_low = $1 THEN user_high ELSE user_low END AS other
         FROM card_pair_requests WHERE card_id = $2 AND (user_low = $1 OR user_high = $1)) r
      WHERE ${visibleTo('r.other')}
      ORDER BY created_at`,
    [viewerId, cardId],
  );
  return result.rows.map((row) => ({ low: row.user_low, high: row.user_high, requesterId: row.requester_id, agreedAt: row.agreed_at }));
}

// Messages in the viewer's agreed Just us two conversations on the card, newest last.
export async function listPairMessages(viewerId: string, cardId: string): Promise<MessageRow[]> {
  const result = await queryDb<RawMessage>(
    `SELECT m.id, m.author_id, m.body, m.created_at, m.edited_at, m.pair_low, m.pair_high
       FROM card_messages m
       JOIN card_pair_requests r
         ON r.card_id = m.card_id AND r.user_low = m.pair_low AND r.user_high = m.pair_high AND r.agreed_at IS NOT NULL
      WHERE m.card_id = $2 AND (m.pair_low = $1 OR m.pair_high = $1)
      ORDER BY m.created_at DESC LIMIT ${MESSAGES_SHOWN}`,
    [viewerId, cardId],
  );
  return result.rows.reverse().map(toMessage);
}

// False when the member already gave this answer on this card: answering again does nothing.
export async function saveAnswer(accountId: string, cardId: string, kind: SeCardAnswerKind): Promise<boolean> {
  const result = await queryDb(
    `INSERT INTO card_answers (card_id, account_id, kind) VALUES ($1, $2, $3)
     ON CONFLICT (card_id, account_id, kind) DO NOTHING RETURNING id`,
    [cardId, accountId, kind],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function insertMessage(cardId: string, authorId: string, body: string, partnerId: string | null): Promise<void> {
  const [low, high] = partnerId ? seCardPair(authorId, partnerId) : [null, null];
  await queryDb(
    `INSERT INTO card_messages (card_id, author_id, body, pair_low, pair_high) VALUES ($1, $2, $3, $4, $5)`,
    [cardId, authorId, body, low, high],
  );
}

// Only the author changes or removes a message, and only on the card it was written on. False when
// there was no such message of theirs. Messages are matched by id as text, so an id that is not a
// UUID finds nothing rather than failing the query.
export async function editOwnMessage(cardId: string, messageId: string, authorId: string, body: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE card_messages SET body = $4, edited_at = NOW()
      WHERE id::text = $1 AND card_id = $2 AND author_id = $3 RETURNING id`,
    [messageId, cardId, authorId, body],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteOwnMessage(cardId: string, messageId: string, authorId: string): Promise<boolean> {
  const result = await queryDb(
    `DELETE FROM card_messages WHERE id::text = $1 AND card_id = $2 AND author_id = $3 RETURNING id`,
    [messageId, cardId, authorId],
  );
  return (result.rowCount ?? 0) > 0;
}

// The other member of a Just us two message the author wrote, or null for a public one or none.
export async function findOwnMessagePartner(cardId: string, messageId: string, authorId: string): Promise<{ found: boolean; partnerId: string | null }> {
  const result = await queryDb<{ pair_low: string | null; pair_high: string | null }>(
    `SELECT pair_low, pair_high FROM card_messages WHERE id::text = $1 AND card_id = $2 AND author_id = $3`,
    [messageId, cardId, authorId],
  );
  const row = result.rows[0];
  if (!row) return { found: false, partnerId: null };
  if (!row.pair_low) return { found: true, partnerId: null };
  return { found: true, partnerId: row.pair_low === authorId ? row.pair_high : row.pair_low };
}

export async function findPair(cardId: string, a: string, b: string): Promise<PairRow | null> {
  const [low, high] = seCardPair(a, b);
  const result = await queryDb<{ requester_id: string; agreed_at: Date | null }>(
    `SELECT requester_id, agreed_at FROM card_pair_requests WHERE card_id = $1 AND user_low = $2 AND user_high = $3`,
    [cardId, low, high],
  );
  const row = result.rows[0];
  return row ? { low, high, requesterId: row.requester_id, agreedAt: row.agreed_at } : null;
}

// True when a new request was made; false when one already existed between the two on this card.
export async function insertPairRequest(cardId: string, requesterId: string, partnerId: string): Promise<boolean> {
  const [low, high] = seCardPair(requesterId, partnerId);
  const result = await queryDb(
    `INSERT INTO card_pair_requests (card_id, user_low, user_high, requester_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (card_id, user_low, user_high) DO NOTHING RETURNING requester_id`,
    [cardId, low, high, requesterId],
  );
  return (result.rowCount ?? 0) > 0;
}

// Only the member who was asked can agree, and only once. False when there was nothing to agree to.
export async function agreePairRequest(cardId: string, agreerId: string, requesterId: string): Promise<boolean> {
  const [low, high] = seCardPair(agreerId, requesterId);
  const result = await queryDb(
    `UPDATE card_pair_requests SET agreed_at = NOW()
      WHERE card_id = $1 AND user_low = $2 AND user_high = $3 AND requester_id = $4 AND agreed_at IS NULL
      RETURNING requester_id`,
    [cardId, low, high, requesterId],
  );
  return (result.rowCount ?? 0) > 0;
}

// Somebody who took part on this card: answered it, wrote in it publicly, or asked or was asked
// for Just us two on it. Only they can be asked to talk just you two from the card.
export async function isParticipant(cardId: string, accountId: string): Promise<boolean> {
  const result = await queryDb<{ yes: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM card_answers WHERE card_id = $1 AND account_id = $2)
         OR EXISTS (SELECT 1 FROM card_messages WHERE card_id = $1 AND author_id = $2 AND pair_low IS NULL)
         OR EXISTS (SELECT 1 FROM card_pair_requests WHERE card_id = $1 AND (user_low = $2 OR user_high = $2)) AS yes`,
    [cardId, accountId],
  );
  return result.rows[0]?.yes ?? false;
}

// A message the reporter can read: public on the card, or in a Just us two they are part of.
export async function findReadableMessage(cardId: string, messageId: string, readerId: string): Promise<MessageRow | null> {
  const result = await queryDb<RawMessage>(
    `SELECT id, author_id, body, created_at, edited_at, pair_low, pair_high FROM card_messages
      WHERE id::text = $1 AND card_id = $2 AND (pair_low IS NULL OR pair_low = $3 OR pair_high = $3)`,
    [messageId, cardId, readerId],
  );
  return result.rows[0] ? toMessage(result.rows[0]) : null;
}
