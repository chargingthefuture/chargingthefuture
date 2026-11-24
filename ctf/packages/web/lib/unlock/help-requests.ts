import { queryDb } from 'lib/db/postgres';
import { normalizeUnlockQuoraHint } from './quora-hint';
import {
  UNLOCK_HELP_SETTLED_STATUSES as SETTLED_REVIEW_STATUSES,
  unlockHelpRequestOpenedRef,
  type UnlockHelpRequestFact,
  type UnlockHelpRequestWrite,
} from './help-request-open';

// Who may reach the Commons without having verified yet.
//
// The Unlock screen asks for a Quora profile URL and, until a member gives one, that screen is the
// only thing they can reach. That is fine for someone who has their URL to hand and a dead end for
// someone who does not: the place to ask for help is the Commons, and the Commons is on the other
// side of the wall they are stuck at. Roughly half of all sign-ups stopped there.
//
// So two things now open the Commons to a member with no submission on file:
//
//   1. They pressed "ask for help" on the Unlock screen — recorded in `unlock_help_requests`. This is
//      the path for a first-time member, who has nothing else to distinguish them yet.
//   2. They have been here on an earlier day — read from `login_events`, which already records one row
//      per member per UTC day. Somebody who saw the Unlock screen, left, and came back has told us by
//      returning that the wall did not work for them, so it stops being a wall.
//
// Either way they land on the Commons with the verification banner above the chat, so the ask is still
// in front of them; it is just no longer the only thing they can do. Members who have a submission are
// unaffected — their stored access tier decides, exactly as before.

// Record that this member asked for help, with whatever they could tell us about their Quora account.
//
// Idempotent on the timestamp: asking twice keeps the first one, so the row stays a record of when they
// first got stuck. The hint is the exception — a member who comes back and finally has a name or a link
// to give must not have it dropped because there is already a row, so a non-empty hint overwrites. A
// second press with an empty box leaves the stored hint alone rather than erasing it.
//
// A request an admin marked done opens again when the member comes back with something new in the box:
// that is new information to look them up with, and the Unlock tile's dot has to say so.
//
// Returns a reference to the request when this press opened one (a first press, or one that reopened a
// request marked done), and null when it only touched a request already open. The admins are told on
// that reference alone, so a repeat press never tells them twice. The reference is built from the
// request's timestamps and never from the member's id, so the Activity row it lands in says nothing
// about who asked and keeps nothing an account deletion would have to find.
export async function recordUnlockHelpRequest(userId: string, quoraHint?: string | null): Promise<string | null> {
  const hint = normalizeUnlockQuoraHint(quoraHint);
  const result = await queryDb<UnlockHelpRequestWrite>(
    `WITH prev AS (SELECT done_at FROM unlock_help_requests WHERE user_id = $1)
     INSERT INTO unlock_help_requests (user_id, requested_at, quora_hint)
     VALUES ($1, NOW(), $2)
     ON CONFLICT (user_id) DO UPDATE
       SET quora_hint = COALESCE(EXCLUDED.quora_hint, unlock_help_requests.quora_hint),
           done_at = CASE WHEN EXCLUDED.quora_hint IS NULL THEN unlock_help_requests.done_at ELSE NULL END
     RETURNING (xmax = 0) AS inserted, requested_at, done_at, (SELECT done_at FROM prev) AS prev_done_at`,
    [userId, hint],
  );
  const row = result.rows[0];
  return row ? unlockHelpRequestOpenedRef(row) : null;
}

export async function listUnlockHelpRequests(): Promise<Map<string, UnlockHelpRequestFact>> {
  const result = await queryDb<{ user_id: string; requested_at: Date; quora_hint: string | null; done_at: Date | null }>(
    `SELECT user_id, requested_at, NULLIF(btrim(quora_hint), '') AS quora_hint, done_at FROM unlock_help_requests`,
  );
  return new Map(
    result.rows.map((row) => [
      row.user_id,
      { requestedAt: new Date(row.requested_at).toISOString(), quoraHint: row.quora_hint, doneAt: row.done_at ? new Date(row.done_at).toISOString() : null },
    ]),
  );
}

// How many help requests are still waiting on an admin, for the Unlock tile's dot on the admin landing.
// The same rule as isUnlockHelpRequestOpen, in SQL.
export async function countOpenUnlockHelpRequests(): Promise<number> {
  const result = await queryDb<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM unlock_help_requests h
      WHERE h.done_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM unlock_verification_submissions s
           WHERE s.user_id = h.user_id AND s.review_status = ANY($1::text[])
        )`,
    [SETTLED_REVIEW_STATUSES],
  );
  return result.rows[0]?.n ?? 0;
}

// An admin marks a member's help request done (or open again). False when the member has no request.
export async function setUnlockHelpRequestDone(userId: string, done: boolean): Promise<boolean> {
  const result = await queryDb(
    `UPDATE unlock_help_requests SET done_at = CASE WHEN $2 THEN NOW() ELSE NULL END WHERE user_id = $1`,
    [userId, done],
  );
  return (result.rowCount ?? 0) > 0;
}

// May the Commons open for this member before they are verified? One query for both conditions, so
// the access gate pays a single round trip.
//
// This applies to a member with no submission AND to one whose submission is sitting in the review
// queue. The waiting case was missed at first, and it was the worse of the two: someone who gave a
// URL and is waiting has a stored `pending_readonly` tier, which passes no gate at all, so pressing
// "ask for help" sent them to a Commons that bounced them straight back to the Unlock screen. They
// had done everything asked of them and still had nobody to ask, for up to the length of the review
// window.
//
// Best-effort: this only ever widens access, so a database failure resolves to false (the member
// keeps the Unlock screen) rather than throwing on a request that would otherwise have worked.
export async function hasUnlockCommonsFallback(userId: string): Promise<boolean> {
  try {
    const result = await queryDb<{ asked_for_help: boolean; returned_later: boolean }>(
      `SELECT
         EXISTS (SELECT 1 FROM unlock_help_requests WHERE user_id = $1) AS asked_for_help,
         EXISTS (
           SELECT 1 FROM login_events
            WHERE user_id = $1
              AND (created_at AT TIME ZONE 'UTC')::date < (NOW() AT TIME ZONE 'UTC')::date
         ) AS returned_later`,
      [userId],
    );
    const row = result.rows[0];
    return Boolean(row?.asked_for_help || row?.returned_later);
  } catch (error) {
    console.error('[unlock] commons-access fallback read failed; keeping the member on the Unlock screen', error);
    return false;
  }
}
