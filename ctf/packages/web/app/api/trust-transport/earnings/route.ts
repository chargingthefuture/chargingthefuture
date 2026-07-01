import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { getMyEarningsBalance } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

// The caller's own available earnings balance (what they can request a payout against). Scoped to the
// caller's user id. The value is a plain balance from the earnings ledger — no currency is asserted.
export async function GET() {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const availableBalance = await getMyEarningsBalance(gate.auth.userId);
    return NextResponse.json({ ok: true, availableBalance }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'earnings' });
    return trustTransportErrorResponse(error, 'Earnings balance unavailable.');
  }
}
