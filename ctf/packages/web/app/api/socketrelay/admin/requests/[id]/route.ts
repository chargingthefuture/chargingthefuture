import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayAdminAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { adminDeleteRequest, insertSocketRelayAudit } from 'lib/socketrelay/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await params;

  try {
    await adminDeleteRequest(id);
    await insertSocketRelayAudit({
      actorId: gate.auth.userId,
      command: 'socketrelay.admin.request.delete',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'request',
      targetId: id,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'admin_requests_id' });
    return socketRelayErrorResponse(error, 'Admin delete unavailable.');
  }
}
