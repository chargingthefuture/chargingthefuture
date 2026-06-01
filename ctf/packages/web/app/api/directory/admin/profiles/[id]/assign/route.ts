import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { assignAdminProfile } from 'lib/directory/repository';
import { reportError } from 'lib/observability/report';

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
  } catch {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
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
    if (!profile) {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Profile not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'directory', op: 'assign_admin_profile', extra: { userId: gate.auth.userId, id, assigneeUserId: userId } });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: 'Unable to assign profile.' },
      { status: 503 },
    );
  }
}
