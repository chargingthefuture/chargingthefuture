import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { getProfileForService, requireDirectoryServiceRead } from 'lib/directory/service-read';
import { logDirectoryAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';

// One Directory profile by id, claimed or not and saying which, for One Percent's desk and nothing
// else. The caller is One Percent's server, with a credential from DIRECTORY_SERVICE_TOKENS; no
// member and no page in this app calls it. The limits are in lib/directory/service-read.ts and the "One Percent is the
// paid tier" section of CLAUDE.md. 404 for a missing profile, and for a claimed one whose owner is
// restricted from connecting, without saying which.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = requireDirectoryServiceRead(request);
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await context.params;

  try {
    const profile = await getProfileForService(id);

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
          message: 'No Directory profile has this id. It may have been removed.',
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
