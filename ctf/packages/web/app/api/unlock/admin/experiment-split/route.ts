import { NextResponse } from 'next/server';
import { requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { getUnlockExperimentSplit, insertUnlockAudit } from 'lib/unlock/repository';
import { reportError } from 'lib/observability/report';

// Read-only admin readout of the early-Commons A/B experiment split (per-bucket Quora-URL completion
// rate). Mirrors what app/admin/unlock/page.tsx reads server-side for the web shell, exposed over HTTP
// so the mobile Unlock admin can render the same panel. Admin-session gated (requireUnlockAdminAccess);
// a read, so no CSRF. Best-effort: getUnlockExperimentSplit returns [] on a query failure, so an empty
// array is a valid "no experiment data yet" response, not an error.
export async function GET(request: Request) {
  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  try {
    const experimentSplit = await getUnlockExperimentSplit();

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.experiment.read',
      policyStatus: 'allow',
      reason: 'ok',
      requestId,
      metadata: { buckets: experimentSplit.length },
    });

    return NextResponse.json({ ok: true, experimentSplit });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_experiment_split' });
    return unlockErrorResponse('Unlock experiment readout unavailable.', 503);
  }
}
