import { NextResponse } from 'next/server';
import { requireDirectoryReadAccess } from '../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { getDirectoryProfileForMember } from 'lib/directory/repository';
import { getWeaversBadgeHolders } from 'lib/contributor-access/badge';
import { logDirectoryAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';

// Single directory profile by id, behind the same read-access gate as the list. Backs the auth-gated
// deep-link page (/apps/directory/profile/[id]) so a shared link opens that profile for a signed-in
// member; unauthenticated visitors never reach this (the gate denies, and the page redirects them to
// the directory landing). 404 when the id matches no active profile.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  try {
    const member = await getDirectoryProfileForMember(id);

    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.profile.get',
      status: 'allow',
      reason: 'directory_discovery',
      targetType: 'directory_profile',
      targetId: id,
      result: member ? 'success' : 'failure',
      errorCategory: member ? null : 'not_found',
    });

    if (!member) {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Profile not found.' },
        { status: 404 },
      );
    }

    // "Weavers of the Commons" contributor badge — only a claimed profile (bound to a real user)
    // carries the field; a community-generated (unclaimed) profile never gets it. Guarded read:
    // any Contributor Access error yields the empty set and the profile still returns.
    if (member.claimedByUserId != null) {
      const badgeHolders = await getWeaversBadgeHolders([member.claimedByUserId]);
      return NextResponse.json(
        { member: { ...member, hasWeaversBadge: badgeHolders.has(member.claimedByUserId) } },
        { status: 200 },
      );
    }

    return NextResponse.json({ member }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'get_profile', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch the profile.' },
      { status: 503 },
    );
  }
}
