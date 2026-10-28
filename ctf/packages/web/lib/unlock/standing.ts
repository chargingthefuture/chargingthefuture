import { seUnlockStanding, type SeUnlockStanding } from '@ctf/shared';
import { queryDb } from 'lib/db/postgres';
import { getUnlockAccessTier } from './access';

// A member's Unlock standing in 3.1: approved or not, which day they are on (counted from their first
// sign-in), and whether posting is paused. One query besides the tier read. The count stops once a
// Quora profile address was sent (any submission row) or the member asked for help finding it.

type StandingRow = { first_seen: Date | null; sent: boolean; asked: boolean };

export async function getUnlockStanding(userId: string, now = new Date()): Promise<SeUnlockStanding> {
  const [tier, result] = await Promise.all([
    getUnlockAccessTier(userId),
    queryDb<StandingRow>(
      `SELECT
         (SELECT MIN(created_at) FROM login_events WHERE user_id = $1) AS first_seen,
         EXISTS (SELECT 1 FROM unlock_verification_submissions WHERE user_id = $1) AS sent,
         EXISTS (SELECT 1 FROM unlock_help_requests WHERE user_id = $1) AS asked`,
      [userId],
    ),
  ]);
  const row = result.rows[0];
  return seUnlockStanding(
    {
      approved: tier === 'approved_full',
      firstSeenIso: row?.first_seen ? new Date(row.first_seen).toISOString() : null,
      countStopped: Boolean(row?.sent || row?.asked),
    },
    now,
  );
}
