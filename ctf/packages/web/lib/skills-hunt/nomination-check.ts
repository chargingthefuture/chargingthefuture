import type { PoolClient } from 'pg';
import { withDbTransaction } from 'lib/db/postgres';
import { isQuoraUrlSuppressed } from 'lib/shared/directory-interface';
import { canonicalizeQuoraUrl } from 'lib/shared/quora-url';

// The nomination that already holds a Quora profile URL: any submission that is not rejected and
// not deleted, in any round. One person is one Quora URL, so a second live nomination for the same
// URL is refused. Read by createSubmission (inside its lock, as the real guard) and by the Scout
// form's check as soon as a link is pasted, so a scout learns before typing the rest of the form.
export async function findNominationBlocker(
  client: PoolClient,
  normalizedUrl: string,
): Promise<{ status: string; round_name: string } | null> {
  const existing = await client.query<{ status: string; round_name: string }>(
    `SELECT s.status, r.name AS round_name
       FROM skills_hunt_submissions s
       JOIN skills_hunt_rounds r ON r.id = s.round_id
      WHERE s.quora_profile_url_normalized = $1
        AND s.status <> 'rejected'
        AND s.deleted_at IS NULL
      ORDER BY s.created_at DESC
      LIMIT 1`,
    [normalizedUrl],
  );
  return existing.rows[0] ?? null;
}

// Plain words for the status of the nomination that is in the way.
function describeBlockingStatus(status: string): string {
  if (status === 'pending') return 'is waiting for review';
  if (status === 'accepted') return 'has already been accepted';
  if (status === 'flagged') return 'is flagged for a second look';
  return `is ${status}`;
}

// Said where the blocker is and what to do with it, because it can sit in a round the admin is not
// looking at or a status their filter hides.
export function describeDuplicateNomination(status: string, round: string): string {
  return `This person is already nominated in the round "${round}", where that nomination ${describeBlockingStatus(status)}. An admin can reject or remove it there if it should not stand.`;
}

export const TAKEN_DOWN_NOMINATION_MESSAGE =
  'This person asked to be removed from the directory, so they cannot be nominated. Contact an admin if you believe that is a mistake.';

export type QuoraNominationCheck =
  | { state: 'not_a_profile_url' }
  | { state: 'open' }
  | { state: 'already_nominated'; message: string }
  | { state: 'taken_down'; message: string };

// The same two refusals createSubmission makes about the person, asked before the form is filled in.
// It does not check the link is reachable on Quora; submit still does that. A link that is not a
// Quora profile yet answers not_a_profile_url, so the form stays quiet while the scout is typing.
export async function checkQuoraUrlForNomination(value: string): Promise<QuoraNominationCheck> {
  const normalized = canonicalizeQuoraUrl(value);
  if (!normalized) return { state: 'not_a_profile_url' };
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (host !== 'quora.com' && !host.endsWith('.quora.com')) return { state: 'not_a_profile_url' };
  } catch {
    return { state: 'not_a_profile_url' };
  }

  return withDbTransaction(async (client) => {
    const blocker = await findNominationBlocker(client, normalized);
    if (blocker) {
      return { state: 'already_nominated', message: describeDuplicateNomination(blocker.status, blocker.round_name) };
    }
    if (await isQuoraUrlSuppressed(client, normalized)) {
      return { state: 'taken_down', message: TAKEN_DOWN_NOMINATION_MESSAGE };
    }
    return { state: 'open' };
  });
}
