import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { overrideSuppressedQuoraUrl } from 'lib/directory/repository';
import { recordDirectoryAdminAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteParams = { params: Promise<{ id: string }> };

// Lift a Quora-URL suppression (override) so it can be listed again. A reason is required and audited.
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

  let reason = '';
  try {
    const body = (await request.json()) as { reason?: unknown };
    reason = typeof body.reason === 'string' ? body.reason : '';
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  if (reason.trim().length === 0) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: 'A reason is required to lift a suppression.' },
      { status: 400 },
    );
  }

  try {
    const result = await overrideSuppressedQuoraUrl(gate.auth.userId, id, reason);

    if (result === 'overridden') {
      await recordDirectoryAdminAudit({
        actorId: gate.auth.userId,
        command: 'directory.admin.takedown.override',
        status: 'allow',
        reason: 'override',
        targetType: 'suppressed_url',
        targetId: id,
        result: 'success',
        errorCategory: null,
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: 'directory.admin.takedown.override',
      status: 'deny',
      reason: result,
      targetType: 'suppressed_url',
      targetId: id,
      result: 'failure',
      errorCategory: result === 'not_found' ? 'not_found' : 'policy',
    });

    if (result === 'not_found') {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.notFound, message: 'Suppression entry not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.conflict, message: 'This suppression has already been lifted.' },
      { status: 409 },
    );
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_suppressed_url_override' });
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.persistenceUnavailable, message: `Unable to lift the suppression: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
