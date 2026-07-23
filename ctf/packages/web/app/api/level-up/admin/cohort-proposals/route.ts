import { NextResponse } from 'next/server';
import { listPendingProposals } from 'lib/level-up/auto-cohort';
import { levelUpErrorResponse, requireLevelUpAdminAccess } from 'lib/level-up/_lib';
import { reportError } from 'lib/observability/report';

// Admin-only: the pending cohort-proposal queue (issue #904), ranked sector-diverse. Read-only; the
// admin approves or dismisses each via the sibling routes.
export async function GET() {
  const gate = await requireLevelUpAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const proposals = await listPendingProposals(100);
    return NextResponse.json({ ok: true, proposals }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'level-up', op: 'admin_cohort_proposals_list' });
    return levelUpErrorResponse(error, 'Cohort proposals unavailable.');
  }
}
