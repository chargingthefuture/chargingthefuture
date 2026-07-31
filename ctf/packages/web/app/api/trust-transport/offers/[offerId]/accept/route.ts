import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, resolveIdempotencyKey, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { acceptOffer, insertTrustTransportAudit } from 'lib/trust-transport/repository';
import { notifySafe } from 'lib/notifications/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ offerId: string }>;
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

  const { offerId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  if (!requestId) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'requestId is required.' },
      { status: 400 },
    );
  }

  const idempotencyKey = resolveIdempotencyKey(body.idempotencyKey, `${gate.auth.userId}:${Date.now()}`);

  try {
    const result = await acceptOffer(requestId, offerId, gate.auth.userId, idempotencyKey);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.offer.accept',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'offer',
      targetId: offerId,
      metadata: { requestId, tripId: result.trip.id },
    });
    // Notify the provider that their transport offer was accepted — best-effort, deduped on the trip
    // id. The accepter is the requester, so the provider is never the actor.
    if (result.trip.providerUserId && result.trip.providerUserId !== gate.auth.userId) {
      await notifySafe({
        userId: result.trip.providerUserId,
        sourcePlugin: 'trust-transport',
        notificationType: 'trust-transport.offer.accepted',
        category: 'safety',
        summary: 'Your TrustTransport offer was accepted.',
        linkPath: '/apps/trust-transport',
        targetRef: result.trip.id,
      });
    }
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'offers_offerid_accept' });
    return trustTransportErrorResponse(error, 'Offer accept unavailable.');
  }
}
