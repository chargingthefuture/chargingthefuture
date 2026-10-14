import { queryDb } from 'lib/db/postgres';
import { UNLOCK_HELP_INTENT_PREFIX, UNLOCK_HELP_SENT_REASON } from './unlock-help-script';
import {
  summarizeUnlockHelp,
  type UnlockHelpLog,
  type UnlockHelpLogRow,
  type UnlockHelpOutcome,
} from './unlock-help-log-format';

// The Unlock help log: every @comic question a member asked about Unlock while they were not yet
// approved, set against what happened next — was the answer sent as scripted, corrected, or refused,
// and was the member approved afterward.
//
// The outcome is the part that matters for improving the script. A path whose members go on to be
// approved is working; a path whose answers keep getting corrected, or whose members never submit, is
// the one to rewrite. It is read, never stored: the outcome is looked up in the Unlock submissions
// table each time the page loads, so it is always current and there is nothing to keep in step.
//
// Read-only and admin-only (app/admin/comic/unlock-help). Nothing here can change a review or a
// member's Unlock status.

export const UNLOCK_HELP_LOG_LIMIT = 500;

type LogDbRow = {
  turn_id: string;
  asked_at: Date | string;
  intent: string;
  question: string;
  user_id: string;
  asker_username: string | null;
  review_status: string | null;
  review_reason: string | null;
  reviewer_user_id: string | null;
  answer_body: string | null;
  rating: string | null;
  unlock_status: string | null;
  unlock_reviewed_at: Date | string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function deriveOutcome(row: LogDbRow): UnlockHelpOutcome {
  if (row.unlock_status === 'approved') return 'approved';
  if (row.unlock_status === 'pending') return 'waiting';
  if (row.unlock_status === null) return 'no_submission';
  return 'not_approved';
}

function daysBetween(from: Date, to: Date | string | null): number | null {
  if (!to) return null;
  return Math.floor((new Date(to).getTime() - from.getTime()) / DAY_MS);
}

function toLogRow(row: LogDbRow): UnlockHelpLogRow {
  const outcome = deriveOutcome(row);
  const askedAt = new Date(row.asked_at);
  return {
    turnId: row.turn_id,
    askedAtIso: askedAt.toISOString(),
    helpCase: row.intent.slice(UNLOCK_HELP_INTENT_PREFIX.length),
    question: row.question,
    userId: row.user_id,
    username: row.asker_username,
    reviewStatus: row.review_status,
    sentWithoutReview: row.review_status === 'approved' && row.reviewer_user_id === null && row.review_reason === UNLOCK_HELP_SENT_REASON,
    answer: row.answer_body,
    rating: row.rating,
    outcome,
    daysToApproval: outcome === 'approved' ? daysBetween(askedAt, row.unlock_reviewed_at) : null,
  };
}

export async function listUnlockHelpLog(): Promise<UnlockHelpLog> {
  const result = await queryDb<LogDbRow>(
    `
      SELECT
        t.id AS turn_id,
        t.created_at AS asked_at,
        t.intent AS intent,
        t.body AS question,
        c.user_id AS user_id,
        c.asker_username AS asker_username,
        q.status AS review_status,
        q.reason AS review_reason,
        q.reviewer_user_id AS reviewer_user_id,
        a.body AS answer_body,
        r.rating AS rating,
        s.review_status AS unlock_status,
        s.reviewed_at AS unlock_reviewed_at
      FROM comic_turns t
      JOIN comic_conversations c ON c.id = t.conversation_id
      LEFT JOIN comic_review_queue q ON q.turn_id = t.id
      LEFT JOIN comic_turns a ON a.id = q.answer_turn_id
      LEFT JOIN comic_answer_ratings r ON r.turn_id = q.answer_turn_id AND r.user_id = c.user_id
      LEFT JOIN unlock_verification_submissions s ON s.user_id = c.user_id
      WHERE t.role = 'user'
        AND t.intent LIKE $1
      ORDER BY t.created_at DESC
      LIMIT $2
    `,
    [`${UNLOCK_HELP_INTENT_PREFIX}%`, UNLOCK_HELP_LOG_LIMIT + 1],
  );
  const truncated = result.rows.length > UNLOCK_HELP_LOG_LIMIT;
  const rows = result.rows.slice(0, UNLOCK_HELP_LOG_LIMIT).map(toLogRow);
  return { rows, summary: summarizeUnlockHelp(rows), truncated };
}
