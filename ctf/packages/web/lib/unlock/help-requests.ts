import { queryDb } from 'lib/db/postgres';

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

// Record that this member asked for help. Idempotent: asking twice keeps the first timestamp, so the
// row stays a record of when they first got stuck.
export async function recordUnlockHelpRequest(userId: string): Promise<void> {
  await queryDb(
    `INSERT INTO unlock_help_requests (user_id, requested_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

// May this member reach the Commons even though they have no submission on file? One query for both
// conditions, so the access gate pays a single round trip. Best-effort: this only ever widens access,
// so a database failure must resolve to false (the member keeps the Unlock screen) rather than throw
// on a request that would otherwise have worked.
export async function hasUnlockCommonsAccessWithoutSubmission(userId: string): Promise<boolean> {
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
