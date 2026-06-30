import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { listMyPayouts } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

export async function GET() {
  // Payouts are scoped to the caller's own earnings by user id, so any signed-in member who has
  // earned (by fulfilling trips) can see their payout history. There is no separate provider role.
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const items = await listMyPayouts(gate.auth.userId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'payouts' });
    return trustTransportErrorResponse(error, 'Payout listing unavailable.');
  }
}
