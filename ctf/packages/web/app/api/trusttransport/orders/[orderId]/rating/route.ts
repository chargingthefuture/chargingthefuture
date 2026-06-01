import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { TRUSTTRANSPORT_ERROR_CODE } from 'lib/trusttransport/constants';
import { submitOrderRating } from 'lib/trusttransport/repository';
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
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
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
    reportError(error, { area: 'trusttransport', op: 'order_rating_submit', extra: { userId: gate.auth.userId, orderId } });
    return trustTransportErrorResponse(error, 'Rating submit unavailable.');
  }
}
