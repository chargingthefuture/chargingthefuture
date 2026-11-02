import { SE_MATCH_MIN_SAME, type SeMatchMessage } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';

// 21 Questions (3.1.0 plan, task 18): a member's answers, the members who answered enough of the
// same questions the same way, and the messages between two matched members. Answers are final.
// A match never includes a person either side has blocked, or whose account is restricted from
// contact; the routes check the same before a message is sent. A member who turned matching off is
// in nobody's matches and sees none, from the next read: matches are worked out on every read and
// kept nowhere, so there is no list to clear.

export const MATCHES_SHOWN = 5;
export const MESSAGES_SHOWN = 50;

const NOT_BLOCKED_OR_RESTRICTED = `
  NOT EXISTS (SELECT 1 FROM member_blocks mb
    WHERE (mb.blocker_user_id = $1 AND mb.blocked_user_id = b.user_id)
       OR (mb.blocker_user_id = b.user_id AND mb.blocked_user_id = $1))
  AND NOT EXISTS (SELECT 1 FROM account_restrictions r
    WHERE r.user_id = b.user_id AND r.is_restricted AND r.restriction_scope IN ('all', 'contact'))
  AND NOT EXISTS (SELECT 1 FROM question_matching_settings s
    WHERE s.user_id IN ($1, b.user_id) AND NOT s.matching_enabled)`;

export type MatchRow = { userId: string; same: number; both: number; sameQuestionIds: string[] };

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function listAnswers(userId: string): Promise<Map<string, number>> {
  const result = await queryDb<{ question_id: string; choice: number }>(
    `SELECT question_id, choice FROM question_answers WHERE user_id = $1`,
    [userId],
  );
  return new Map(result.rows.map((row) => [row.question_id, row.choice]));
}

// False when the question was already answered: the first answer stands. Every answer goes into
// question_answer_audit, and so does a refused attempt to give a different one, with the answer
// that stands; sending the same answer again records nothing.
export async function saveAnswer(userId: string, questionId: string, choice: number): Promise<boolean> {
  const result = await queryDb<{ saved: boolean }>(
    `WITH prior AS (SELECT choice FROM question_answers WHERE user_id = $1 AND question_id = $2),
          ins AS (
            INSERT INTO question_answers (user_id, question_id, choice) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, question_id) DO NOTHING RETURNING 1),
          audit AS (
            INSERT INTO question_answer_audit (user_id, action, question_id, choice, prior_choice)
            SELECT $1, CASE WHEN EXISTS (SELECT 1 FROM ins) THEN 'answered' ELSE 'answer_refused' END, $2, $3,
                   (SELECT choice FROM prior)
             WHERE EXISTS (SELECT 1 FROM ins) OR (SELECT choice FROM prior) IS DISTINCT FROM $3::smallint)
     SELECT EXISTS (SELECT 1 FROM ins) AS saved`,
    [userId, questionId, choice],
  );
  return result.rows[0]?.saved ?? false;
}

export type MatchingState = { answered: number; enabled: boolean };

// How many questions the member answered, and whether they are matched. No row means on.
export async function readMatchingState(userId: string): Promise<MatchingState> {
  const result = await queryDb<{ answered: number; enabled: boolean | null }>(
    `SELECT (SELECT COUNT(*)::int FROM question_answers WHERE user_id = $1) AS answered,
            (SELECT matching_enabled FROM question_matching_settings WHERE user_id = $1) AS enabled`,
    [userId],
  );
  const row = result.rows[0];
  return { answered: row?.answered ?? 0, enabled: row?.enabled ?? true };
}

// Only the member's own toggle calls this; answering a question never does. A real change (no row
// counts as on) goes into question_answer_audit as matching_off or matching_on.
export async function setMatchingEnabled(userId: string, enabled: boolean): Promise<void> {
  await queryDb(
    `WITH prior AS (SELECT matching_enabled FROM question_matching_settings WHERE user_id = $1),
          up AS (
            INSERT INTO question_matching_settings (user_id, matching_enabled, updated_at) VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET matching_enabled = EXCLUDED.matching_enabled, updated_at = NOW())
     INSERT INTO question_answer_audit (user_id, action)
     SELECT $1, CASE WHEN $2 THEN 'matching_on' ELSE 'matching_off' END
      WHERE COALESCE((SELECT matching_enabled FROM prior), TRUE) <> $2`,
    [userId, enabled],
  );
}

async function readMatches(userId: string, otherUserId: string | null, limit: number): Promise<MatchRow[]> {
  const result = await queryDb<{ user_id: string; same: number; answered_both: number; same_ids: string[] | null }>(
    `SELECT b.user_id,
            COUNT(*) FILTER (WHERE a.choice = b.choice)::int AS same,
            COUNT(*)::int AS answered_both,
            (ARRAY_AGG(b.question_id ORDER BY b.answered_at DESC) FILTER (WHERE a.choice = b.choice))[1:3] AS same_ids
       FROM question_answers a
       JOIN question_answers b ON b.question_id = a.question_id AND b.user_id <> a.user_id
      WHERE a.user_id = $1 AND ($3::text IS NULL OR b.user_id = $3) AND ${NOT_BLOCKED_OR_RESTRICTED}
      GROUP BY b.user_id
     HAVING COUNT(*) FILTER (WHERE a.choice = b.choice) >= $2
      ORDER BY same DESC, answered_both ASC, b.user_id
      LIMIT $4`,
    [userId, SE_MATCH_MIN_SAME, otherUserId, limit],
  );
  return result.rows.map((row) => ({ userId: row.user_id, same: row.same, both: row.answered_both, sameQuestionIds: row.same_ids ?? [] }));
}

export function listMatches(userId: string): Promise<MatchRow[]> {
  return readMatches(userId, null, MATCHES_SHOWN);
}

export async function findMatch(userId: string, otherUserId: string): Promise<MatchRow | null> {
  return (await readMatches(userId, otherUserId, 1))[0] ?? null;
}

export type ConversationSummary = { lastBody: string | null; lastAtIso: string | null; unread: number };

// The last message and how many the viewer has not read, for each of their matches.
export async function summarizeConversations(userId: string, otherUserIds: string[]): Promise<Map<string, ConversationSummary>> {
  if (otherUserIds.length === 0) return new Map();
  const result = await queryDb<{ other: string; last_body: string; last_at: Date; unread: number }>(
    `SELECT DISTINCT ON (other) other, body AS last_body, created_at AS last_at,
            (SELECT COUNT(*)::int FROM question_match_messages u
              WHERE u.user_low = m.user_low AND u.user_high = m.user_high
                AND u.sender_user_id <> $1 AND u.read_at IS NULL) AS unread
       FROM (SELECT *, CASE WHEN user_low = $1 THEN user_high ELSE user_low END AS other
               FROM question_match_messages WHERE user_low = $1 OR user_high = $1) m
      WHERE other = ANY($2::text[])
      ORDER BY other, created_at DESC`,
    [userId, otherUserIds],
  );
  return new Map(
    result.rows.map((row) => [row.other, { lastBody: row.last_body, lastAtIso: new Date(row.last_at).toISOString(), unread: row.unread }]),
  );
}

// The newest messages between two members, oldest first, and marks the viewer's unread ones read.
export async function readConversation(userId: string, otherUserId: string): Promise<SeMatchMessage[]> {
  const [low, high] = pair(userId, otherUserId);
  const result = await queryDb<{ id: string; sender_user_id: string; body: string; created_at: Date }>(
    `SELECT id, sender_user_id, body, created_at FROM question_match_messages
      WHERE user_low = $1 AND user_high = $2 ORDER BY created_at DESC LIMIT $3`,
    [low, high, MESSAGES_SHOWN],
  );
  await queryDb(
    `UPDATE question_match_messages SET read_at = NOW()
      WHERE user_low = $1 AND user_high = $2 AND sender_user_id <> $3 AND read_at IS NULL`,
    [low, high, userId],
  );
  return result.rows.reverse().map((row) => ({
    id: row.id,
    mine: row.sender_user_id === userId,
    body: row.body,
    createdAtIso: new Date(row.created_at).toISOString(),
  }));
}

export async function sendMessage(userId: string, otherUserId: string, body: string): Promise<SeMatchMessage> {
  const [low, high] = pair(userId, otherUserId);
  const result = await queryDb<{ id: string; created_at: Date }>(
    `INSERT INTO question_match_messages (user_low, user_high, sender_user_id, body)
     VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
    [low, high, userId, body],
  );
  const row = result.rows[0];
  return { id: row.id, mine: true, body, createdAtIso: new Date(row.created_at).toISOString() };
}
