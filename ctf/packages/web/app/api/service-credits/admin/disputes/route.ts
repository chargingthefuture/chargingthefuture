import { NextResponse } from 'next/server';
import { listOpenDisputes } from 'lib/service-credits/repository';
import { requireServiceCreditsAdminAccess, serviceCreditsErrorResponse } from 'lib/service-credits/_lib';
import { reportError } from 'lib/observability/report';

// Admin-only, read-only: open disputes (a dispute with no adjustment applied yet), newest first, so an
// admin can see which cases still need a resolution. There is no status column on the disputes table,
// so "open" is derived from the absence of a matching service_credits_dispute_adjustments row. Backs
// the admin disputes review list and the admin-landing "new to review" dot. No fiat equivalent.
export async function GET() {
  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const disputes = await listOpenDisputes(100);
    return NextResponse.json({ ok: true, disputes }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'admin-open-disputes' });
    return serviceCreditsErrorResponse(error, 'Open disputes unavailable.');
  }
}
