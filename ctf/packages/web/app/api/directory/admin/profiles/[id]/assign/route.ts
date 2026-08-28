import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { assignAdminProfile } from 'lib/directory/repository';
import { recordDirectoryAdminAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = { params: Promise<{ id: string }> };

type AssignBody = {
  userId?: unknown;
};

export async function PUT(request: Request, { params }: RouteParams) {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { id } = await params;

  let body: AssignBody;
  try {
    body = (await request.json()) as AssignBody;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (userId.length === 0) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'userId is required.' },
      { status: 400 },
    );
  }

  try {
    const profile = await assignAdminProfile(gate.auth.userId, id, userId);
    if (profile === 'already_claimed') {
      await recordDirectoryAdminAudit({
        actorId: gate.auth.userId,
        command: 'directory.admin.profile.assign',
        status: 'deny',
        reason: 'invalid_claimed_unclaimed_transition',
        targetType: 'profile',
        targetId: id,
        result: 'failure',
        errorCategory: 'claimed_guard',
        metadata: { assignedUserId: userId },
      });

      return NextResponse.json(
        {
          ok: false,
          code: DIRECTORY_ERROR_CODE.claimedProfileGuard,
          message: 'This profile is already claimed by another member.',
        },
        { status: 409 },
      );
    }

    if (!profile) {
      await recordDirectoryAdminAudit({
        actorId: gate.auth.userId,
        command: 'directory.admin.profile.assign',
        status: 'deny',
        reason: 'not_found',
        targetType: 'profile',
        targetId: id,
        result: 'failure',
        errorCategory: 'not_found',
        metadata: { assignedUserId: userId },
      });

      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Profile not found.' },
        { status: 404 },
      );
    }

    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.profile.assign',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'profile',
      targetId: id,
      result: 'success',
      errorCategory: null,
      metadata: { assignedUserId: userId },
    });

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_profiles_id_assign' });
    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.profile.assign',
      status: 'allow',
      reason: 'admin_route_guard',
      targetType: 'profile',
      targetId: id,
      result: 'failure',
      errorCategory: 'persistence_error',
      metadata: { assignedUserId: userId },
    });

    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to assign profile: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
