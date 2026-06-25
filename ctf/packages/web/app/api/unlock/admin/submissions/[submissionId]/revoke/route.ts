import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, unlockErrorResponse } from 'lib/unlock/_lib';
import {
  getUnlockRuntimeConfig,
  getUnlockSubmissionById,
  insertUnlockAudit,
  revokeUnlockSubmissionReward,
} from 'lib/unlock/repository';
import { burnCredits, insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{ submissionId: string }>;
};

type RevokeBody = {
  reviewNote?: string;
};

// Admin determination "loser" path. Revokes a submission's verification reward: claws the ServiceCredits
// back (a governance burn) and drops the account to support-only + rejected, so the duplicate-identity guard
// can hand the reward to the right account. Used when a Quora identity was approved on more than one account
// (or by a perp impersonating a victim). The burn is best-effort — if the account already spent the credits
// there is nothing to claw back, but access is still revoked and the row is marked so reconcile never
// re-grants it. Idempotent: a second call on an already-revoked submission is a no-op.
export async function POST(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const resolvedParams = await params;
  const submissionId = Number(resolvedParams.submissionId);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return unlockErrorResponse('submissionId must be a positive integer.', 400);
  }

  let body: RevokeBody = {};
  try {
    body = (await request.json()) as RevokeBody;
  } catch {
    body = {};
  }

  try {
    const existing = await getUnlockSubmissionById(submissionId);
    if (!existing) {
      return unlockErrorResponse('Unlock submission not found.', 404);
    }
    if (existing.rewardRevokedAt) {
      // Already revoked — idempotent no-op.
      return NextResponse.json({ ok: true, submission: existing, creditsReclaimed: false, alreadyRevoked: true });
    }

    // Claw the reward back if it was actually granted. Best-effort: an insufficient balance (already spent)
    // must not block the access revocation.
    let creditsReclaimed = false;
    let reclaimAmount = 0;
    if (existing.incentiveGrantedAt) {
      const runtimeConfig = await getUnlockRuntimeConfig();
      reclaimAmount = runtimeConfig.incentiveAmount;
      try {
        const burn = await burnCredits({
          actorId: gate.auth.userId,
          targetUserId: existing.userId,
          amount: reclaimAmount,
          burnReason: 'unlock_reward_revoked_duplicate_identity',
          governanceTicketId: `unlock:revoke:submission:${submissionId}`,
          idempotencyKey: `unlock-revoke-submission-${submissionId}`,
        });
        creditsReclaimed = true;
        await insertServiceCreditsAudit({
          actorId: gate.auth.userId,
          command: 'service-credits.governance.burn.unlock.revoke',
          policyStatus: 'allow',
          reason: 'unlock_reward_revoked',
          targetType: 'governance_event',
          targetId: burn.governanceEventId,
          metadata: { unlockSubmissionId: submissionId, targetUserId: existing.userId, amount: reclaimAmount },
        });
      } catch (burnError) {
        // Leave creditsReclaimed false; the access revocation below still proceeds. Surface for diagnosis.
        reportError(burnError, { area: 'unlock', op: 'admin_submissions_submissionid_revoke_burn', extra: { submissionId } });
      }
    }

    const submission = await revokeUnlockSubmissionReward({
      actorUserId: gate.auth.userId,
      submissionId,
      reviewNote: body.reviewNote,
    });
    if (!submission) {
      return unlockErrorResponse('Unlock submission not found.', 404);
    }

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.submission.revoke',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: submission.userId,
      metadata: { submissionId, creditsReclaimed, reclaimAmount },
    });

    return NextResponse.json({ ok: true, submission, creditsReclaimed, reclaimAmount });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_submissionid_revoke' });
    return unlockErrorResponse('Unlock reward revoke unavailable.', 503);
  }
}
