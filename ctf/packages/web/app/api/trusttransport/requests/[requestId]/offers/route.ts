import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { getRequestById, listOffersForRequest } from 'lib/trusttransport/repository';
import { TRUSTTRANSPORT_ERROR_CODE } from 'lib/trusttransport/constants';
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
        { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.requestNotFound, message: 'Request not found.' },
        { status: 404 },
      );
    }

    if (!gate.auth.isAdmin && request.requesterUserId !== gate.auth.userId) {
      return NextResponse.json(
        { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.policyDenied, message: 'Operation denied by policy.' },
        { status: 403 },
      );
    }

    const items = await listOffersForRequest(requestId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'request_offers_list', extra: { userId: gate.auth.userId, requestId } });
    return trustTransportErrorResponse(error, 'Offer listing unavailable.');
  }
}
