import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { submitOrderRating } from 'lib/trust-transport/repository';
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const score = typeof body.score === 'number' ? body.score : Number.NaN;
  const feedback = typeof body.feedback === 'string' ? body.feedback : null;
  const { orderId } = await params;

  try {
    await submitOrderRating(orderId, gate.auth.userId, gate.auth.isAdmin, { score, feedback });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'orders_orderid_rating' });
    return trustTransportErrorResponse(error, 'Rating submit unavailable.');
  }
}
