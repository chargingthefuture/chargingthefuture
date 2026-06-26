import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { getRequestById } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ requestId: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { requestId } = await params;

  try {
    const item = await getRequestById(requestId);
    if (!item) {
      return NextResponse.json(
        { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.requestNotFound, message: 'Request not found.' },
        { status: 404 },
      );
    }

    if (!gate.auth.isAdmin && item.requesterUserId !== gate.auth.userId) {
      return NextResponse.json(
        { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.policyDenied, message: 'Operation denied by policy.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'requests_requestid' });
    return trustTransportErrorResponse(error, 'Request lookup unavailable.');
  }
}
