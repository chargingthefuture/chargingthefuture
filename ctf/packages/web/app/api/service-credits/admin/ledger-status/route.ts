import { NextResponse } from 'next/server';
import { requireServiceCreditsAdminAccess } from 'lib/service-credits/_lib';
import { getFormanceConfigStatus } from 'lib/service-credits/formance-ledger';
import { countQueuedFormancePosts } from 'lib/service-credits/formance-replay';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// Admin-only, read-only report of the external ledger (Formance) configuration so the owner can see,
// from the ServiceCredits admin page, whether the ledger mirror is wired up and how far behind it is.
export async function GET() {
  const gate = await requireServiceCreditsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // queue: movements still waiting to be copied to Formance (issue #2907). Counts only.
    const [formance, queue] = await Promise.all([getFormanceConfigStatus(), countQueuedFormancePosts()]);
    return NextResponse.json({ ok: true, formance, queue }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'service-credits', op: 'ledger_status' });
    return NextResponse.json(
      { ok: false, message: `Unable to read ledger status: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
