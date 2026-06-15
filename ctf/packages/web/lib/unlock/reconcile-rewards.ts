import {
  getUnlockRuntimeConfig,
  listApprovedUnincentivizedSubmissions,
  markUnlockIncentiveGranted,
} from './repository';
import { insertServiceCreditsAudit, mintGrant } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';

export type UnlockRewardReconcileResult = {
  scanned: number;
  granted: number;
  alreadyGranted: number;
  failed: number;
};

// Self-heals missed Unlock approval rewards. The approval handler mints the 100-credit reward as a
// best-effort follow-up; if that mint fails (e.g. a transient ledger outage) the approval still stands
// but the reward never lands and nothing retries. This drains the approved-but-uncredited backlog and
// mints each idempotently — the same actor + idempotency key the handler uses, plus the
// markUnlockIncentiveGranted guard — so it can run on a schedule and can never double-grant.
export async function reconcileUnlockRewards(limit = 100): Promise<UnlockRewardReconcileResult> {
  const submissions = await listApprovedUnincentivizedSubmissions(limit);
  const runtimeConfig = await getUnlockRuntimeConfig();

  let granted = 0;
  let alreadyGranted = 0;
  let failed = 0;

  for (const submission of submissions) {
    const idempotencyKey = `unlock-approval-submission-${submission.id}`;
    try {
      const grant = await mintGrant({
        actorId: 'unlock-incentive-system',
        targetUserId: submission.userId,
        amount: runtimeConfig.incentiveAmount,
        grantReason: 'unlock_quora_verification_approval',
        governanceTicketId: `unlock:submission:${submission.id}`,
        idempotencyKey,
      });

      // Flip the per-submission flag last. If it was already set by a racing run, markUnlockIncentiveGranted
      // returns false and we count it as already-granted rather than a fresh grant.
      const marked = await markUnlockIncentiveGranted(submission.id);
      if (!marked) {
        alreadyGranted += 1;
        continue;
      }

      granted += 1;
      await insertServiceCreditsAudit({
        actorId: 'unlock-incentive-system',
        command: 'service-credits.governance.mint.grant.unlock.reconcile',
        policyStatus: 'allow',
        reason: 'unlock_reward_reconciliation',
        targetType: 'governance_event',
        targetId: grant.governanceEventId,
        metadata: {
          unlockSubmissionId: submission.id,
          targetUserId: submission.userId,
          amount: runtimeConfig.incentiveAmount,
          idempotencyKey,
        },
      });
    } catch (error) {
      failed += 1;
      reportError(error, { area: 'unlock', op: 'reconcile_rewards', extra: { submissionId: submission.id } });
    }
  }

  return { scanned: submissions.length, granted, alreadyGranted, failed };
}
