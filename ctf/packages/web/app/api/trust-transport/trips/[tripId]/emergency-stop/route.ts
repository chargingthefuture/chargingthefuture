import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { triggerEmergencyStop } from 'lib/trust-transport/repository';
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
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'trips_tripid_emergency_stop' });
    return trustTransportErrorResponse(error, 'Emergency stop unavailable.');
  }
}
