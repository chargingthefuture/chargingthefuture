import {
  getUnlockRewardHolderForUrl,
  getUnlockRuntimeConfig,
  listApprovedUnincentivizedSubmissions,
  markUnlockIncentiveGranted,
  markUnlockRewardWithheld,
} from './repository';
import { insertServiceCreditsAudit, mintGrant } from 'lib/shared/credits-interface';
import { reportError } from 'lib/observability/report';
import type { UnlockSubmission } from './types';

// The outcome of trying to grant one submission's verification reward.
//   granted        — the 100-credit reward was minted (first/only account for this Quora identity).
//   withheld       — another account already holds this identity's reward; held for an admin determination.
//   already_granted — a racing run already granted this exact submission (the per-submission guard caught it).
export type UnlockRewardGrantOutcome =
  | { status: 'granted'; governanceEventId: string; amount: number }
  | { status: 'withheld'; holderUserId: string }
  | { status: 'already_granted' };

// Grants the verification reward for one approved submission, behind the duplicate-identity guard: a
// normalized Quora URL earns the reward on ONE account, so if another account already holds this identity's
// reward, this one is HELD (reward_withheld_at) for an admin determination instead of minting a second
// reward for the same person. Shared by the approval handler, the hourly reconcile, and the admin "grant to
// this account" determination, so the guard can never be bypassed. The mint is idempotent (per-submission
// idempotency key + the markUnlockIncentiveGranted flag), so this is safe to retry.
export async function grantUnlockRewardForSubmission(
  submission: UnlockSubmission,
): Promise<UnlockRewardGrantOutcome> {
  const runtimeConfig = await getUnlockRuntimeConfig();

  const holderUserId = await getUnlockRewardHolderForUrl(
    submission.quoraProfileUrlNormalized,
    submission.userId,
  );
  if (holderUserId) {
    await markUnlockRewardWithheld(submission.id);
    return { status: 'withheld', holderUserId };
  }

  const grant = await mintGrant({
    actorId: 'unlock-incentive-system',
    targetUserId: submission.userId,
    amount: runtimeConfig.incentiveAmount,
    grantReason: 'unlock_quora_verification_approval',
    governanceTicketId: `unlock:submission:${submission.id}`,
    idempotencyKey: `unlock-approval-submission-${submission.id}`,
  });

  // The credit already existed (idempotency replay) — a prior run minted it, possibly crashing before it
  // could flip the per-submission flag. Repair the flag, but report already_granted so the caller does not
  // double-count this as a fresh grant or write a second follow-up audit for a credit that already landed.
  if (grant.replayed) {
    await markUnlockIncentiveGranted(submission.id);
    return { status: 'already_granted' };
  }

  // Fresh mint. Flip the per-submission flag last. If a racing run set it first, markUnlockIncentiveGranted
  // returns false and we report already_granted rather than a fresh grant.
  const marked = await markUnlockIncentiveGranted(submission.id);
  if (!marked) {
    return { status: 'already_granted' };
  }

  return { status: 'granted', governanceEventId: grant.governanceEventId, amount: runtimeConfig.incentiveAmount };
}

export type UnlockRewardReconcileResult = {
  scanned: number;
  granted: number;
  alreadyGranted: number;
  // Submissions held by the duplicate-identity guard — a real person, but the reward already went to one of
  // their accounts. Surfaced so a held reward is visible from the route response / cron log, not silent.
  withheld: number;
  failed: number;
  // Per-submission failure reasons, so a stuck reward is diagnosable from the route response / cron log
  // instead of only from Sentry. The message is the mint error (schema-level text only, no secrets).
  errors: { submissionId: number; message: string }[];
};

// Self-heals missed Unlock approval rewards. The approval handler mints the reward as a best-effort
// follow-up; if that mint fails the approval still stands but the reward never lands and nothing retries.
// This drains the approved-but-uncredited backlog (excluding rewards held or revoked by the duplicate
// guard) and grants each idempotently through the shared guard, so it can run on a schedule and can never
// double-grant or pay a duplicate identity.
export async function reconcileUnlockRewards(limit = 100): Promise<UnlockRewardReconcileResult> {
  const submissions = await listApprovedUnincentivizedSubmissions(limit);

  let granted = 0;
  let alreadyGranted = 0;
  let withheld = 0;
  let failed = 0;
  const errors: { submissionId: number; message: string }[] = [];

  for (const submission of submissions) {
    try {
      const outcome = await grantUnlockRewardForSubmission(submission);
      if (outcome.status === 'withheld') {
        withheld += 1;
        continue;
      }
      if (outcome.status === 'already_granted') {
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
        targetId: outcome.governanceEventId,
        metadata: {
          unlockSubmissionId: submission.id,
          targetUserId: submission.userId,
          amount: outcome.amount,
        },
      });
    } catch (error) {
      failed += 1;
      errors.push({ submissionId: submission.id, message: error instanceof Error ? error.message : 'unknown_error' });
      reportError(error, { area: 'unlock', op: 'reconcile_rewards', extra: { submissionId: submission.id } });
    }
  }

  return { scanned: submissions.length, granted, alreadyGranted, withheld, failed, errors };
}
