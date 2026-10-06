import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { insertTrustTransportAudit, triggerEmergencyStop } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ tripId: string }>;
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

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional here; a missing or malformed JSON body leaves the empty defaults in place.
  }

  const notes = typeof body.notes === 'string' ? body.notes : null;
  const { tripId } = await params;

  try {
    const result = await triggerEmergencyStop(tripId, gate.auth.userId, gate.auth.isAdmin, notes);
    // Same audit event the status route writes for a lifecycle change: an emergency freeze is a
    // terminal transition and must leave a record of who triggered it.
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.trip.status.update',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'trip',
      targetId: tripId,
      metadata: { nextStatus: 'emergency_frozen', requestId: result.request.id },
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'trips_tripid_emergency_stop' });
    return trustTransportErrorResponse(error, 'Emergency stop unavailable.');
  }
}
