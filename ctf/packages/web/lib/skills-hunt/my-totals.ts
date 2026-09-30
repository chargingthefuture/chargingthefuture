import { queryDb } from 'lib/db/postgres';

// A member's own nomination counts across every round. Only ever read for the signed-in member:
// the route passes the session user id and accepts none from the request, so nobody can see
// another member's totals. Removed rows (`deleted_at`) are left out, as they are everywhere a
// member sees their own nominations.
export type SkillsHuntMyTotals = {
  submitted: number;
  profilesCreated: number;
  accepted: number;
  pending: number;
  flagged: number;
  rejected: number;
};

type MyTotalsRow = {
  submitted: string;
  profiles_created: string;
  accepted: string;
  pending: string;
  flagged: string;
  rejected: string;
};

function toCount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getMyTotals(userId: string): Promise<SkillsHuntMyTotals> {
  // `directory_profile_generated_at` is stamped on the nomination when accepting it created a
  // community-generated Directory profile, so it still counts after that profile is claimed.
  const result = await queryDb<MyTotalsRow>(
    `
      SELECT
        COUNT(*)::text AS submitted,
        COUNT(*) FILTER (WHERE directory_profile_generated_at IS NOT NULL)::text AS profiles_created,
        COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted,
        COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
        COUNT(*) FILTER (WHERE status = 'flagged')::text AS flagged,
        COUNT(*) FILTER (WHERE status = 'rejected')::text AS rejected
      FROM skills_hunt_submissions
      WHERE submitter_user_id = $1
        AND deleted_at IS NULL
    `,
    [userId],
  );
  const row = result.rows[0];
  return {
    submitted: toCount(row?.submitted),
    profilesCreated: toCount(row?.profiles_created),
    accepted: toCount(row?.accepted),
    pending: toCount(row?.pending),
    flagged: toCount(row?.flagged),
    rejected: toCount(row?.rejected),
  };
}
