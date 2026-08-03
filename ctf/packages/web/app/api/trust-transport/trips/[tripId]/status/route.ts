import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { insertTrustTransportAudit, updateTripStatus } from 'lib/trust-transport/repository';
import type { TrustTransportTripStatus } from 'lib/trust-transport/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type RouteProps = {
  params: Promise<{ tripId: string }>;
};

const VALID_NEXT_STATUSES: TrustTransportTripStatus[] = [
  'assigned',
  'en_route',
  'picked_up',
  'delivered',
  'completed',
  'canceled',
  'disputed',
  'emergency_frozen',
];

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
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const nextStatus = typeof body.nextStatus === 'string' ? body.nextStatus : '';
  if (!VALID_NEXT_STATUSES.includes(nextStatus as TrustTransportTripStatus)) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'nextStatus is invalid.' },
      { status: 400 },
    );
  }

  const note = typeof body.note === 'string' ? body.note : null;
  const { tripId } = await params;

  try {
    const result = await updateTripStatus(tripId, gate.auth.userId, gate.auth.isAdmin, nextStatus as TrustTransportTripStatus, note);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.trip.status.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'trip',
      targetId: tripId,
      metadata: { nextStatus },
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'trips_tripid_status' });
    return trustTransportErrorResponse(error, 'Trip status update unavailable.');
  }
}
