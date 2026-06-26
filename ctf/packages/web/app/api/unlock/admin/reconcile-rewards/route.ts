import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { reconcileUnlockRewards } from 'lib/unlock/reconcile-rewards';
import { reportError } from 'lib/observability/report';

// Admin-triggered self-heal for stuck Unlock approval rewards.
//
// The 100-credit verification reward is minted best-effort when an admin approves a submission; if
// that inline mint fails, the reward sits "pending" until something retries it. The hourly cron does
// that automatically, but the cron needs a CRON_SECRET configured in both GitHub Actions and the app
// runtime. This route gives an admin the same drain on demand from the Unlock admin screen — gated by
// the admin session, so it needs no CRON_SECRET. It calls the exact same idempotent mint (same actor +
// idempotency key + markUnlockIncentiveGranted guard), so it can never double-grant a reward.
export async function POST(request: Request) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  try {
    const result = await reconcileUnlockRewards();

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.rewards.reconcile',
      policyStatus: 'allow',
      reason: 'ok',
      requestId,
      metadata: { ...result },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_reconcile_rewards' });
    return unlockErrorResponse('Unlock reward reconciliation unavailable.', 503);
  }
}
