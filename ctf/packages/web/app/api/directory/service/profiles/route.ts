import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import {
  invalidListParams,
  listProfilesForService,
  parseServiceListParams,
  requireDirectoryServiceList,
} from 'lib/directory/service-list';
import { logDirectoryAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';

// A page of Directory profiles, claimed or not and saying which, for One Percent's Find matches on
// the owner's desk and nothing else (owner decision, 2026-10-07). The caller is One Percent's
// server, with a credential from DIRECTORY_SERVICE_TOKENS; no member and no page in this app calls
// it. Parameters: `limit` (default 50, at most 100) and `cursor` (the `nextCursor` of the page
// before). The limits are in lib/directory/service-list.ts and the "One Percent is the paid tier"
// section of CLAUDE.md.
//
// The audit names the consumer, the page size and which page this was, and never the profile ids
// on it, so the trail doesn't become a copy of who was read.
export async function GET(request: Request) {
  const gate = requireDirectoryServiceList(request);
  if (!gate.allowed) {
    return gate.response;
  }

  const params = parseServiceListParams(new URL(request.url));
  if (!params.ok) {
    return invalidListParams(params.message);
  }
  const pageNumber = params.cursor?.page ?? 1;

  try {
    const page = await listProfilesForService(params.limit, params.cursor);

    logDirectoryAudit({
      actorId: gate.actorId,
      command: 'directory.profile.service.list',
      status: 'allow',
      reason: 'approved_consumer',
      targetType: 'directory_profile_page',
      targetId: `page-${pageNumber}`,
      result: 'success',
      errorCategory: null,
      metadata: {
        pageSize: params.limit,
        page: pageNumber,
        returned: page.profiles.length,
        hasMore: page.nextCursor !== null,
      },
    });

    return NextResponse.json(page, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'service_list_profiles', extra: { actorId: gate.actorId, page: pageNumber } });
    return NextResponse.json(
      {
        ok: false,
        code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
        message: 'The Directory database did not answer, so the page of profiles could not be read. Try again in a minute.',
      },
      { status: 503 },
    );
  }
}
