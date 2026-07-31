import { queryDb } from 'lib/db/postgres';
import type { SpamQuoraUrlEntry } from './types';

// Persistent denylist of normalized Quora profile URLs an admin has marked as spam. It is deliberately
// keyed on the normalized URL, not on any member id: the per-member submission row is hard-deleted when
// a member deletes their data, but this denylist is retained (see the account deletion registry) so the
// same Quora account cannot slip back into the review queue on a fresh account. A later approve/reject
// of the same URL removes it here, so a mistaken spam mark is fully reversible.

// Reason marker written on the platform-wide restriction we place when a submission is marked spam
// (by an admin) or auto-marked spam at submission time (denylist hit). A later non-spam decision lifts
// the restriction only when it carries this exact marker, so an unrelated admin restriction is never
// disturbed.
export const UNLOCK_SPAM_RESTRICTION_REASON = 'unlock:spam';

// Actor recorded on the restriction/audit when a denylisted URL is auto-blocked at submission time —
// no admin performed the action, so it is attributed to the system rather than to the member.
export const UNLOCK_SPAM_DENYLIST_ACTOR = 'system:unlock-spam-denylist';

// Record a normalized Quora URL on the denylist (or bump its counters if already present).
export async function addSpamQuoraUrl(input: {
  quoraProfileUrlNormalized: string;
  quoraProfileUrl: string;
  actorUserId: string;
}): Promise<void> {
  await queryDb(
    `INSERT INTO unlock_spam_quora_urls
       (quora_profile_url_normalized, quora_profile_url, flagged_by_user_id, flag_count, first_flagged_at, last_flagged_at, updated_at)
     VALUES ($1, $2, $3, 1, NOW(), NOW(), NOW())
     ON CONFLICT (quora_profile_url_normalized)
     DO UPDATE SET
       quora_profile_url = EXCLUDED.quora_profile_url,
       flagged_by_user_id = EXCLUDED.flagged_by_user_id,
       flag_count = unlock_spam_quora_urls.flag_count + 1,
       last_flagged_at = NOW(),
       updated_at = NOW()`,
    [input.quoraProfileUrlNormalized, input.quoraProfileUrl, input.actorUserId],
  );
}

// Remove a normalized Quora URL from the denylist (used when a spam mark is reversed).
export async function removeSpamQuoraUrl(quoraProfileUrlNormalized: string): Promise<void> {
  await queryDb(`DELETE FROM unlock_spam_quora_urls WHERE quora_profile_url_normalized = $1`, [
    quoraProfileUrlNormalized,
  ]);
}

// Is this normalized Quora URL on the spam denylist?
export async function isSpamQuoraUrl(quoraProfileUrlNormalized: string): Promise<boolean> {
  const result = await queryDb(
    `SELECT 1 FROM unlock_spam_quora_urls WHERE quora_profile_url_normalized = $1 LIMIT 1`,
    [quoraProfileUrlNormalized],
  );
  return result.rows.length > 0;
}

// List the denylist for the admin panel, most-recently-flagged first.
export async function listSpamQuoraUrls(limit = 200): Promise<SpamQuoraUrlEntry[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 500 ? Math.floor(limit) : 200;
  const result = await queryDb<{
    quora_profile_url_normalized: string;
    quora_profile_url: string;
    flagged_by_user_id: string | null;
    flag_count: number;
    first_flagged_at: Date;
    last_flagged_at: Date;
  }>(
    `SELECT quora_profile_url_normalized, quora_profile_url, flagged_by_user_id, flag_count, first_flagged_at, last_flagged_at
     FROM unlock_spam_quora_urls
     ORDER BY last_flagged_at DESC
     LIMIT $1`,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    quoraProfileUrlNormalized: row.quora_profile_url_normalized,
    quoraProfileUrl: row.quora_profile_url,
    flaggedByUserId: row.flagged_by_user_id,
    flagCount: row.flag_count,
    firstFlaggedAt: row.first_flagged_at.toISOString(),
    lastFlaggedAt: row.last_flagged_at.toISOString(),
  }));
}
