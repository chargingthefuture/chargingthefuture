import { NextResponse } from 'next/server';
import { requireDirectoryReadAccess } from '../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { listDirectoryForMember, parsePaginationParams } from 'lib/directory/repository';
import { logDirectoryAudit } from 'lib/directory/audit';
import { getWeaversBadgeHolders } from 'lib/contributor-access/badge';
import { reportError } from 'lib/observability/report';

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
    const payload = await listDirectoryForMember(pagination, getFilters(request.url));

    // "Weavers of the Commons" contributor badge — one guarded set-lookup for the whole page.
    // Only a claimed profile (bound to a real user) can carry the field; community-generated
    // (unclaimed) profiles never get it. The helper returns the empty set on any error, so a
    // Contributor Access outage can never break the directory list.
    const claimedIds = payload.items
      .map((item) => item.claimedByUserId)
      .filter((id): id is string => id != null);
    const badgeHolders = await getWeaversBadgeHolders(claimedIds);
    const items = payload.items.map((item) =>
      item.claimedByUserId == null
        ? item
        : { ...item, hasWeaversBadge: badgeHolders.has(item.claimedByUserId) },
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
