import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import {
  clearUnlockRewardWithheld,
  getUnlockSubmissionById,
  insertUnlockAudit,
} from 'lib/unlock/repository';
import { grantUnlockRewardForSubmission } from 'lib/unlock/reconcile-rewards';
import { insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{ submissionId: string }>;
};

type ParsedSubmissionId =
  | { ok: true; submissionId: number }
  | { ok: false; response: ReturnType<typeof unlockErrorResponse> };

function parseSubmissionId(value: string): ParsedSubmissionId {
  const submissionId = Number(value);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return { ok: false, response: unlockErrorResponse('submissionId must be a positive integer.', 400) };
  }
  return { ok: true, submissionId };
}

// Admin determination "winner" path. Grants a held verification reward to this account — the admin decides
// this is the account that keeps the Quora identity. Clears the hold, then grants through the shared guard.
// If another account STILL holds the identity's reward (it was not revoked first), the guard withholds again
// and this returns 409 with the current holder, so the admin knows to revoke that account first. Idempotent:
// if the reward already landed, this is a no-op.
export async function POST(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  const resolvedParams = await params;
  const parsedId = parseSubmissionId(resolvedParams.submissionId);
  if (!parsedId.ok) {
    return parsedId.response;
  }
  const { submissionId } = parsedId;

  try {
    const existing = await getUnlockSubmissionById(submissionId);
    if (!existing) {
      return unlockErrorResponse('Unlock submission not found.', 404);
    }
    if (existing.reviewStatus !== 'approved') {
      return unlockErrorResponse('Only an approved submission can be granted its reward.', 409);
    }
    if (existing.incentiveGrantedAt) {
      // Already granted — idempotent no-op.
      return NextResponse.json({ ok: true, submission: existing, alreadyGranted: true });
    }

    // The admin chose this account; clear the hold so the guard can grant it.
    await clearUnlockRewardWithheld(submissionId);

    const outcome = await grantUnlockRewardForSubmission(existing);
    if (outcome.status === 'withheld') {
      // Another account still holds this identity's reward. Re-held; the admin must revoke that one first.
      return NextResponse.json(
        {
          ok: false,
          code: 'unlock_reward_still_held',
          message: 'Another account still holds this Quora identity’s reward. Revoke that account first, then grant this one.',
          holderUserId: outcome.holderUserId,
        },
        { status: 409 },
      );
    }

    if (outcome.status === 'granted') {
      await insertServiceCreditsAudit({
        actorId: gate.auth.userId,
        command: 'service-credits.governance.mint.grant.unlock.determination',
        policyStatus: 'allow',
        reason: 'unlock_duplicate_determination_grant',
        targetType: 'governance_event',
        targetId: outcome.governanceEventId,
        metadata: { unlockSubmissionId: submissionId, targetUserId: existing.userId, amount: outcome.amount },
      });
    }

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.reward.grant',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: existing.userId,
      requestId,
      metadata: { submissionId, outcome: outcome.status },
    });

    const submission = await getUnlockSubmissionById(submissionId);
    return NextResponse.json({ ok: true, submission });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_submissionid_grant_reward' });
    return unlockErrorResponse('Unlock reward grant unavailable.', 503);
  }
}
