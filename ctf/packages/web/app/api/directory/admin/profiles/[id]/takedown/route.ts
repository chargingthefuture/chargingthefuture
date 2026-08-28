import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { takedownAdminProfile } from 'lib/directory/repository';
import { recordDirectoryAdminAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import { failureReason, withReason } from 'lib/errors/failure';

type RouteParams = { params: Promise<{ id: string }> };

type TakedownResult = Awaited<ReturnType<typeof takedownAdminProfile>>;
type TakedownDenyResult = Exclude<TakedownResult, 'taken_down'>;

// Reads and validates the required takedown reason. Returns the trimmed-nonempty reason string, or a
// ready-to-send error response (invalid JSON body, or an empty/missing reason).
async function parseTakedownReason(request: Request): Promise<{ error: NextResponse } | { reason: string }> {
  let reason = '';
  try {
    const body = (await request.json()) as { reason?: unknown };
    reason = typeof body.reason === 'string' ? body.reason : '';
  } catch (caught) {
    return {
      error: NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: withReason('Invalid JSON body', caught) },
        { status: 400 },
      ),
    };
  }

  if (reason.trim().length === 0) {
    return {
      error: NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'A reason is required to take down a profile.' },
        { status: 400 },
      ),
    };
  }

  return { reason };
}

// The audit `reason` recorded for each non-success takedown outcome.
function denyReasonFor(result: TakedownDenyResult): string {
  return result === 'not_found'
    ? 'not_found'
    : result === 'claimed_guard'
      ? 'invalid_claimed_unclaimed_transition'
      : result === 'not_community_generated'
        ? 'not_community_generated'
        : 'missing_quora_url';
}

// The response sent for each non-success takedown outcome.
function denyResponseFor(result: TakedownDenyResult): NextResponse {
  if (result === 'not_found') {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Profile not found.' },
      { status: 404 },
    );
  }
  if (result === 'claimed_guard') {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.claimedProfileGuard, message: 'Claimed profiles cannot be taken down; unassign first.' },
      { status: 409 },
    );
  }
  // not_community_generated / missing_quora_url — a takedown only applies to a nominated
  // (community-generated) profile that carries a Quora URL. Use the ordinary delete otherwise.
  return NextResponse.json(
    {
      ok: false,
      code: DIRECTORY_ERROR_CODE.conflict,
      message:
        result === 'not_community_generated'
          ? 'Takedown is only for community-generated profiles. Use delete for this one.'
          : 'This profile has no Quora URL to suppress. Use delete instead.',
    },
    { status: 409 },
  );
}

// Take down a community-generated profile at the person's request (they have no account and asked to
// be removed). Unlike the ordinary delete, this also blocks the profile's Quora URL from being listed
// again until an admin lifts the block. A reason is required and recorded in the audit trail.
export async function POST(request: Request, { params }: RouteParams) {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;

  const parsed = await parseTakedownReason(request);
  if ('error' in parsed) {
    return parsed.error;
  }
  const { reason } = parsed;

  try {
    const result = await takedownAdminProfile(gate.auth.userId, id, reason);

    if (result === 'taken_down') {
      await recordDirectoryAdminAudit({
        actorId: gate.auth.userId,
        command: 'directory.admin.profile.takedown',
        status: 'allow',
        reason: 'takedown_request',
        targetType: 'profile',
        targetId: id,
        result: 'success',
        errorCategory: null,
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.profile.takedown',
      status: 'deny',
      reason: denyReasonFor(result),
      targetType: 'profile',
      targetId: id,
      result: 'failure',
      errorCategory: result === 'not_found' ? 'not_found' : 'policy',
    });

    return denyResponseFor(result);
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_profile_takedown' });
    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.profile.takedown',
      status: 'allow',
      reason: 'takedown_request',
      targetType: 'profile',
      targetId: id,
      result: 'failure',
      errorCategory: 'persistence_error',
    });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to take down profile: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
