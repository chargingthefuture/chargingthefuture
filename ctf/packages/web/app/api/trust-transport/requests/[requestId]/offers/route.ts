import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { getRequestById, listOffersForRequest } from 'lib/trust-transport/repository';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
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
    const request = await getRequestById(requestId);
    if (!request) {
      return NextResponse.json(
        { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.requestNotFound, message: 'Request not found.' },
        { status: 404 },
      );
    }

    if (!gate.auth.isAdmin && request.requesterUserId !== gate.auth.userId) {
      return NextResponse.json(
        { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.policyDenied, message: 'Operation denied by policy.' },
        { status: 403 },
      );
    }

    const items = await listOffersForRequest(requestId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'requests_requestid_offers' });
    return trustTransportErrorResponse(error, 'Offer listing unavailable.');
  }
}
