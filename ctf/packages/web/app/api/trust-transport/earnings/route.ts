import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { getRecordedEarningsByCurrency } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

// The caller's recorded earnings from completed trips, per currency (only currencies with a nonzero
// total). Scoped to the caller's user id. This is a read-only record — for anything other than
// ServiceCredits the payment is arranged peer-to-peer off-platform, so there is no withdrawable balance
// and no payout to request. The same figures feed the GDP recognition layer.
export async function GET() {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const earnings = await getRecordedEarningsByCurrency(gate.auth.userId);
    return NextResponse.json({ ok: true, earnings }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'earnings' });
    return trustTransportErrorResponse(error, 'Earnings record unavailable.');
  }
}
