import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { cancelOrder, insertTrustTransportAudit } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ orderId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional here; a missing or malformed JSON body leaves the empty defaults in place.
  }

  const reason = typeof body.reason === 'string' ? body.reason : null;
  const { orderId } = await params;

  try {
    await cancelOrder(orderId, gate.auth.userId, gate.auth.isAdmin, reason);
    // Canceling an order also cancels every unfinished trip on it, so it writes the same audit event as
    // the status route. The target is the request: the trips canceled with it are found by request id.
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.trip.status.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'request',
      targetId: orderId,
      metadata: { nextStatus: 'canceled', requestId: orderId },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'orders_orderid_cancel' });
    return trustTransportErrorResponse(error, 'Order cancel unavailable.');
  }
}
