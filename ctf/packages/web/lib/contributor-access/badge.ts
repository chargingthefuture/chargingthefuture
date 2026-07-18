import { queryDb } from 'lib/db/postgres';

// Contributor Access — the "Weavers of the Commons" badge read (the module's only member-facing
// output). Given a set of user ids, return the subset that currently holds the badge:
// eligible = TRUE and revoked_for_cause = FALSE. Categorical only — no score, no dates, no
// reason data ever leaves this function; callers get a set membership and nothing else.
//
// Guarded like the rest of the module (see member-value-counts.ts): the single query is gated on
// the table existing and any error returns the empty set, so a caller surface (the Directory
// profile read paths) can never break because this module is unavailable. Missing badge data
// simply renders nothing — which is also the positive-only rule: absence is never shown.
export async function getWeaversBadgeHolders(userIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(userIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (ids.length === 0) {
    return new Set();
  }
  try {
    const reg = await queryDb<{ reg: string | null }>(`SELECT to_regclass($1)::text AS reg`, [
      'public.contributor_access_eligibility',
    ]);
    if (!reg.rows[0]?.reg) {
      return new Set();
    }
    const result = await queryDb<{ user_id: string }>(
      `SELECT user_id FROM contributor_access_eligibility
       WHERE eligible = TRUE AND revoked_for_cause = FALSE AND user_id = ANY($1::text[])`,
      [ids],
    );
    return new Set(result.rows.map((row) => row.user_id));
  } catch {
    return new Set();
  }
}
