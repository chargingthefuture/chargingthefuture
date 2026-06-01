import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { cancelOrder } from 'lib/trusttransport/repository';
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
  }

  const reason = typeof body.reason === 'string' ? body.reason : null;
  const { orderId } = await params;

  try {
    await cancelOrder(orderId, gate.auth.userId, gate.auth.isAdmin, reason);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'order_cancel', extra: { userId: gate.auth.userId, orderId } });
    return trustTransportErrorResponse(error, 'Order cancel unavailable.');
  }
}
