import { NextResponse } from 'next/server';
import { getCirculationMetrics } from 'lib/service-credits/repository';
import { requireServiceCreditsReadAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';

// Public, all-members circulation view: aggregate, non-identifying numbers only. No per-member figure
// and no fiat equivalent. This transparency is what makes the economy trustworthy.
export async function GET() {
  const gate = await requireServiceCreditsReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const metrics = await getCirculationMetrics();
    return NextResponse.json({ ok: true, metrics }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'circulation' });
    return serviceCreditsErrorResponse(error, 'Circulation metrics unavailable.');
  }
}
