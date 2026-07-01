import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { listProviderTrips } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

// Trips the caller is fulfilling (they are the provider). Returns the now-revealed pickup/drop-off
// (acceptance is the model-B reveal point) so the provider can advance the trip through its lifecycle.
export async function GET() {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listProviderTrips(gate.auth.userId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'trips' });
    return trustTransportErrorResponse(error, 'Trip listing unavailable.');
  }
}
