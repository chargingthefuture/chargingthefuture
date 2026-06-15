import { NextResponse } from 'next/server';
import { getCirculationMetrics } from 'lib/service-credits/repository';
import { requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';

// Admin circulation view: the public aggregates plus the operator levers (mint budget remaining,
// concentration, open disputes). Admin-gated. No fiat equivalent.
export async function GET() {
  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const metrics = await getCirculationMetrics({ includeAdmin: true });
    return NextResponse.json({ ok: true, metrics }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin-circulation' });
    return serviceCreditsErrorResponse(error, 'Circulation metrics unavailable.');
  }
}
