import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { TRUSTTRANSPORT_ERROR_CODE } from 'lib/trusttransport/constants';
import { updateTripStatus } from 'lib/trusttransport/repository';
import { reportError } from 'lib/observability/report';
import type { TrustTransportTripStatus } from 'lib/trusttransport/types';

type RouteProps = {
  params: Promise<{ tripId: string }>;
};

const VALID_NEXT_STATUSES: TrustTransportTripStatus[] = [
  'assigned',
  'en_route',
  'picked_up',
  'delivered',
  'completed',
  'cancelled',
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
  } catch {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const nextStatus = typeof body.nextStatus === 'string' ? body.nextStatus : '';
  if (!VALID_NEXT_STATUSES.includes(nextStatus as TrustTransportTripStatus)) {
    return NextResponse.json(
      { ok: false, code: TRUSTTRANSPORT_ERROR_CODE.invalidPayload, message: 'nextStatus is invalid.' },
      { status: 400 },
    );
  }

  const note = typeof body.note === 'string' ? body.note : null;
  const { tripId } = await params;

  try {
    const result = await updateTripStatus(tripId, gate.auth.userId, gate.auth.isAdmin, nextStatus as TrustTransportTripStatus, note);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'trip_status_update', extra: { userId: gate.auth.userId, tripId } });
    return trustTransportErrorResponse(error, 'Trip status update unavailable.');
  }
}
