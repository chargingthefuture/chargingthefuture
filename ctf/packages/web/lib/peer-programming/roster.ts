import { resolveUsernames } from '../identity/resolve-usernames';
import { listCohortMemberUserIds } from './repository';

// A cohort member surfaced to a roster: the user id plus their resolved display name (null when it
// could not be resolved, e.g. a Clerk lookup failure — the client falls back to a short id).
export type CohortMember = {
  userId: string;
  username: string | null;
};

// Build `{ cohortId -> members[] }` with usernames resolved in a single Clerk lookup for all ids
// across the given cohorts. Best-effort: ids that do not resolve keep `username: null`.
export async function buildCohortRosters(cohortIds: string[]): Promise<Map<string, CohortMember[]>> {
  const idsByCohort = await listCohortMemberUserIds(cohortIds);
  const allUserIds = Array.from(new Set([...idsByCohort.values()].flat()));
  const names = await resolveUsernames(allUserIds);

  const rosters = new Map<string, CohortMember[]>();
  for (const [cohortId, userIds] of idsByCohort) {
    rosters.set(
      cohortId,
      userIds.map((userId) => ({ userId, username: names.get(userId) ?? null })),
    );
  }
  return rosters;
}
