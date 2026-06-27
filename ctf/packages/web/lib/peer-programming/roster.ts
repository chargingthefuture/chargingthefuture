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
//
// `limitPerCohort` caps how many members each cohort's roster lists (the earliest joiners). Username
// resolution is an external Clerk call, so an uncapped roster is unbounded external work per read.
// Under the single standing, always-open Cohort 1 mode one cohort holds every active member, so the
// room passes a cap to keep that read bounded; the admin surface passes none and lists everyone. The
// caller still shows the true total separately (cohort.memberCount), so a capped roster is a display
// limit, not a wrong count.
export async function buildCohortRosters(
  cohortIds: string[],
  limitPerCohort?: number,
): Promise<Map<string, CohortMember[]>> {
  const idsByCohort = await listCohortMemberUserIds(cohortIds);
  const cap = typeof limitPerCohort === 'number' && limitPerCohort >= 0 ? limitPerCohort : undefined;

  const cappedByCohort = new Map<string, string[]>();
  for (const [cohortId, userIds] of idsByCohort) {
    cappedByCohort.set(cohortId, cap === undefined ? userIds : userIds.slice(0, cap));
  }

  const allUserIds = Array.from(new Set([...cappedByCohort.values()].flat()));
  const names = await resolveUsernames(allUserIds);

  const rosters = new Map<string, CohortMember[]>();
  for (const [cohortId, userIds] of cappedByCohort) {
    rosters.set(
      cohortId,
      userIds.map((userId) => ({ userId, username: names.get(userId) ?? null })),
    );
  }
  return rosters;
}
