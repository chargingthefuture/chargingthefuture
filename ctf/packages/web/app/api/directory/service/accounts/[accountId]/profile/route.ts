import { NextResponse } from 'next/server';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { getClaimedProfileForAccountService, requireDirectoryServiceRead } from 'lib/directory/service-read';
import { logDirectoryAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';

// The claimed Directory profile that belongs to one account, for One Percent's desk and nothing
// else. One Percent's clients sign in there with their Skills Economy account, so it already holds
// the account id; this saves the owner looking their profile up and pasting the link. The same
// credential, rate limit and limits as the by-id read next to it (lib/directory/service-read.ts and
// the "One Percent is the paid tier" section of CLAUDE.md).
//
// 404 when the account has no claimed profile, when it's restricted from connecting, and when it
// doesn't exist: the answer never says which. The audit names the profile when one is found and
// never the account id, so the trail doesn't become a list of who signed in over there.
export async function GET(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const gate = requireDirectoryServiceRead(request);
  if (!gate.allowed) {
    return gate.response;
  }

  const { accountId } = await context.params;

  try {
    const profile = await getClaimedProfileForAccountService(accountId);

    logDirectoryAudit({
      actorId: gate.actorId,
      command: 'directory.profile.service.by-account.get',
      status: 'allow',
      reason: 'approved_consumer',
      targetType: 'directory_profile',
      targetId: profile ? profile.id : 'no-claimed-profile',
      result: profile ? 'success' : 'failure',
      errorCategory: profile ? null : 'not_found',
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          code: DIRECTORY_ERROR_CODE.notFound,
          message: 'No claimed Directory profile belongs to this account. They may not have claimed one yet.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'service_get_profile_by_account', extra: { actorId: gate.actorId } });
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
