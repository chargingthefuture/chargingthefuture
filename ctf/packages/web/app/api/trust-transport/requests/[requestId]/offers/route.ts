import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { createOffer, getRequestById, insertTrustTransportAudit, listOffersForRequest } from 'lib/trust-transport/repository';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { requestId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const note = typeof body.note === 'string' ? body.note : null;
  const proposedAmount = typeof body.proposedAmount === 'number' ? body.proposedAmount : null;

  try {
    const offer = await createOffer(requestId, gate.auth.userId, { note, proposedAmount });
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.offer.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'offer',
      targetId: offer.id,
      metadata: { requestId, proposedAmount: offer.proposedAmount },
    });
    return NextResponse.json({ ok: true, offer }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'requests_requestid_offers_create' });
    return trustTransportErrorResponse(error, 'Offer creation unavailable.');
  }
}
