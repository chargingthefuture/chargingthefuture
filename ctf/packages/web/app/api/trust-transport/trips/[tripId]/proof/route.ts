import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { TRUST_TRANSPORT_ERROR_CODE } from 'lib/trust-transport/constants';
import { captureTripProof } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'Invalid JSON body.', reason: failureReason(error) },
      { status: 400 },
    );
  }

  const artifactType = typeof body.artifactType === 'string' ? body.artifactType : '';
  const artifactRedacted = typeof body.artifactRedacted === 'string' ? body.artifactRedacted : '';

  if (!artifactType || !artifactRedacted) {
    return NextResponse.json(
      { ok: false, code: TRUST_TRANSPORT_ERROR_CODE.invalidPayload, message: 'artifactType and artifactRedacted are required.' },
      { status: 400 },
    );
  }

  const { tripId } = await params;

  try {
    await captureTripProof(tripId, gate.auth.userId, gate.auth.isAdmin, artifactType as 'photo' | 'code' | 'note', artifactRedacted);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'trips_tripid_proof' });
    return trustTransportErrorResponse(error, 'Trip proof capture unavailable.');
  }
}
