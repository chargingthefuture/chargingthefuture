import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayAdminAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { adminDeleteRequest } from 'lib/socket-relay/repository';
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
    // The audit row is written inside adminDeleteRequest's transaction, so the delete and its audit
    // are atomic — the removal is never committed without its audit record.
    await adminDeleteRequest(id, {
      actorId: gate.auth.userId,
      command: 'socket-relay.admin.request.delete',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'request',
      targetId: id,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'admin_requests_id' });
    return socketRelayErrorResponse(error, 'Admin delete unavailable.');
  }
}
