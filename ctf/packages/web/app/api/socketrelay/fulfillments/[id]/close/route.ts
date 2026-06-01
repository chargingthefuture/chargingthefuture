import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireSocketRelayReadAccess, socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { closeFulfillment } from 'lib/socketrelay/repository';
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

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
  }

  const { id } = await params;
  const reason = typeof body.reason === 'string' ? body.reason : null;

  try {
    const item = await closeFulfillment(id, gate.auth.userId, gate.auth.isAdmin, reason);
    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'socketrelay', op: 'fulfillments_id_close' });
    return socketRelayErrorResponse(error, 'Fulfillment close unavailable.');
  }
}
