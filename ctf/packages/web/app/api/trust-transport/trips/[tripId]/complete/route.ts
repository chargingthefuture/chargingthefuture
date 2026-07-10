import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { confirmTripCompletion, insertTrustTransportAudit } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ tripId: string }>;
};

// Record the caller's completion confirmation. Neither party can complete a trip alone — this only
// actually completes the trip (and fires settlement) once both the requester and the provider have
// confirmed. See confirmTripCompletion() for why: completion triggers a ServiceCredits debit or an
// earnings-ledger credit for an off-platform exchange the platform never verified, so a single unilateral
// "mark complete" is not enough.
export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { tripId } = await params;

  try {
    const result = await confirmTripCompletion(tripId, gate.auth.userId);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.trip.completion.confirm',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'trip',
      targetId: tripId,
      metadata: { bothConfirmed: result.bothConfirmed },
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'trips_tripid_complete' });
    return trustTransportErrorResponse(error, 'Trip completion confirmation unavailable.');
  }
}
