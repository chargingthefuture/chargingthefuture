import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { getClaimedProfileForService, requireDirectoryServiceRead } from 'lib/directory/service-read';
import { logDirectoryAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';

// One claimed Directory profile by id, for One Percent's desk and nothing else. The caller is
// One Percent's server, with a credential from DIRECTORY_SERVICE_TOKENS; no member and no page in
// this app calls it. The limits are in lib/directory/service-read.ts and the "One Percent is the
// paid tier" section of CLAUDE.md. 404 for an unclaimed profile as well as a missing one.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = requireDirectoryServiceRead(request);
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  try {
    const profile = await getClaimedProfileForService(id);

    logDirectoryAudit({
      actorId: gate.actorId,
      command: 'directory.profile.service.get',
      status: 'allow',
      reason: 'approved_consumer',
      targetType: 'directory_profile',
      targetId: id,
      result: profile ? 'success' : 'failure',
      errorCategory: profile ? null : 'not_found',
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          code: DIRECTORY_ERROR_CODE.notFound,
          message: 'No claimed Directory profile has this id. It may be unclaimed, or it may have been removed.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'service_get_profile', extra: { actorId: gate.actorId } });
    return NextResponse.json(
      {
        ok: false,
        code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
        message: 'The Directory database did not answer, so the profile could not be read. Try again in a minute.',
      },
      { status: 503 },
    );
  }
}
