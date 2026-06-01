import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trusttransport/_lib';
import { triggerEmergencyStop } from 'lib/trusttransport/repository';
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
  }

  const notes = typeof body.notes === 'string' ? body.notes : null;
  const { tripId } = await params;

  try {
    const result = await triggerEmergencyStop(tripId, gate.auth.userId, gate.auth.isAdmin, notes);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trusttransport', op: 'trip_emergency_stop', extra: { userId: gate.auth.userId, tripId } });
    return trustTransportErrorResponse(error, 'Emergency stop unavailable.');
  }
}
