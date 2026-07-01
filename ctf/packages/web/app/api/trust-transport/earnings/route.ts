import { NextResponse } from 'next/server';
import { requireTrustTransportReadAccess, trustTransportErrorResponse } from 'lib/trust-transport/_lib';
import { getEarningsBalancesByCurrency } from 'lib/trust-transport/repository';
import { reportError } from 'lib/observability/report';

// The caller's own available earnings balance, per currency (only currencies with a nonzero balance),
// which a payout can be requested against. Scoped to the caller's user id.
export async function GET() {
  const gate = await requireTrustTransportReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const balances = await getEarningsBalancesByCurrency(gate.auth.userId);
    return NextResponse.json({ ok: true, balances }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'trust-transport', op: 'earnings' });
    return trustTransportErrorResponse(error, 'Earnings balance unavailable.');
  }
}
