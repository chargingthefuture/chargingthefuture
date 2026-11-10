import { NextResponse } from 'next/server';
import { requireDirectoryReadAccess } from '../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryForMember, parsePaginationParams } from 'lib/directory/repository';
import { logDirectoryAudit } from 'lib/directory/audit';
import { getWeaversBadgeHolders } from 'lib/contributor-access/badge';
import { reportError } from 'lib/observability/report';
import { findUserIdsByUsername, resolveMemberIdentities } from 'lib/identity/resolve-usernames';

function getFilters(url: string) {
  const params = new URL(url).searchParams;

  return {
    sectorId: params.get('sectorId'),
    jobTitleId: params.get('jobTitleId'),
    skillId: params.get('skillId'),
    q: params.get('q'),
  };
}

export async function GET(request: Request) {
  const gate = await requireDirectoryReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const pagination = parsePaginationParams(request.url);

  try {
    const filters = getFilters(request.url);
    // A member is found by username too (owner decision, 2026-11-10): Clerk is asked which accounts'
    // usernames contain the term, and their claimed profiles join the matches.
    const usernameUserIds = filters.q ? await findUserIdsByUsername(filters.q) : [];
    const payload = await listDirectoryForMember(pagination, { ...filters, usernameUserIds });

    // "Weavers of the Commons" contributor badge — one guarded set-lookup for the entire page.
    // Only a claimed profile (bound to a real user) can carry the field; community-generated
    // (unclaimed) profiles never get it. The helper returns the empty set on any error, so a
    // Contributor Access outage can never break the directory list.
    const claimedIds = payload.items
      .map((item) => item.claimedByUserId)
      .filter((id): id is string => id != null);
    // Each claimed profile also carries its member's username, from Clerk, shown beside the name.
    const [badgeHolders, identities] = await Promise.all([getWeaversBadgeHolders(claimedIds), resolveMemberIdentities(claimedIds)]);
    const items = payload.items.map((item) =>
      item.claimedByUserId == null
        ? item
        : {
            ...item,
            hasWeaversBadge: badgeHolders.has(item.claimedByUserId),
            username: identities.get(item.claimedByUserId)?.username ?? null,
          },
    );

    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.list.fetch',
      status: 'allow',
      reason: 'directory_discovery',
      targetType: 'directory_list',
      targetId: gate.auth.userId,
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ...payload, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'list_members', extra: { userId: gate.auth.userId } });
    logDirectoryAudit({
      actorId: gate.auth.userId,
      command: 'directory.list.fetch',
      status: 'allow',
      reason: 'directory_discovery',
      targetType: 'directory_list',
      targetId: gate.auth.userId,
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to fetch directory list.' },
      { status: 503 },
    );
  }
}
