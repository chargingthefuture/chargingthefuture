import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socket-relay/_lib';
import { claimRequest } from 'lib/socket-relay/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireSocketRelayReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { id } = await params;

  try {
    const created = await claimRequest(id, gate.auth.userId);
    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'socket-relay', op: 'requests_id_fulfill' });
    return socketRelayErrorResponse(error, 'Fulfillment claim unavailable.');
  }
}
