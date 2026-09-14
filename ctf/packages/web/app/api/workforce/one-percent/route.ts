import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
// Through the platform interface, never lib/directory directly — plugins stay isolated (rule 112).
import { getOwnProfile } from 'lib/shared/directory-interface';
import { WORKFORCE_ERROR_CODE } from 'lib/workforce/constants';
import {
  computeOnePercentRateLadder,
  computeOnePercentReach,
  initialsFor,
  ONE_PERCENT_ROUTES,
  type OnePercentCard,
} from 'lib/workforce/one-percent';
import { failureResponse } from 'lib/errors/failure';

/**
 * What's Your 1% — the signed-in member's own card, and nobody else's.
 *
 * Workforce already answers what the whole population would look like. This answers the question a
 * member actually asks, which is what THEY could do, and it only ever answers it about them: the
 * profile is read by the caller's own user id, and no id is accepted from the client.
 *
 * A member with no claimed Directory listing gets the arithmetic without a card, plus the ask to
 * claim one. Guessing a name and a trade for somebody would be worse than showing nothing.
 */
export async function GET() {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  try {
    const profile = await getOwnProfile(decision.userId);
    const reach = computeOnePercentReach();

    const card: OnePercentCard = profile
      ? {
          initials: initialsFor(profile.firstName, profile.lastName),
          firstName: profile.firstName,
          lastName: profile.lastName,
          jobTitleName: profile.jobTitleName,
          // The Directory's own order, and its own list — including the skills a member added
          // themselves that are not yet in the shared catalog. A skill somebody claims is a skill.
          skills: [...profile.skills.map((skill) => skill.name), ...profile.pendingSkills],
          isUnclaimed: false,
        }
      : {
          initials: '?',
          firstName: '',
          lastName: null,
          jobTitleName: null,
          skills: [],
          isUnclaimed: true,
        };

    return NextResponse.json(
      { ok: true, card, reach, ladder: computeOnePercentRateLadder(reach), routes: ONE_PERCENT_ROUTES },
      { status: 200 },
    );
  } catch (error) {
    return failureResponse({
      summary: 'Unable to work out your 1%',
      error,
      code: WORKFORCE_ERROR_CODE.persistenceUnavailable,
      area: 'workforce',
      op: 'one_percent_read',
      status: 503,
      audience: decision.isAdmin ? 'operator' : 'member',
    });
  }
}
