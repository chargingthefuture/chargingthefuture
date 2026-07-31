import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportAdminAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { insertTrustTransportAudit, resolveIncident } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

type RouteProps = {
  params: Promise<{ incidentId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireTrustTransportAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { incidentId } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional here; a missing or malformed JSON body leaves the empty defaults in place.
  }

  const resolutionNotes = typeof body.resolutionNotes === 'string' ? body.resolutionNotes : null;

  try {
    await resolveIncident(incidentId, gate.auth.userId, resolutionNotes);
    await insertTrustTransportAudit({
      actorId: gate.auth.userId,
      command: 'trust-transport.admin.dispute.resolve',
      policyStatus: 'allow',
      reason: 'ok',
      targetType: 'incident',
      targetId: incidentId,
      metadata: { resolutionNotes },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'admin_incidents_incidentid_resolve' });
    return trustTransportErrorResponse(error, 'Incident resolve unavailable.');
  }
}
