import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
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

type UnlockSubmissionRecord = NonNullable<Awaited<ReturnType<typeof getUnlockSubmissionById>>>;

type ReclaimOutcome = { creditsReclaimed: boolean; reclaimAmount: number };

// Claw the reward back if it was actually granted. Best-effort: an insufficient balance (already spent)
// must not block the access revocation, so a burn failure is reported and swallowed here.
async function reclaimUnlockReward(
  submission: UnlockSubmissionRecord,
  actorUserId: string,
  submissionId: number,
): Promise<ReclaimOutcome> {
  if (!submission.incentiveGrantedAt) {
    return { creditsReclaimed: false, reclaimAmount: 0 };
  }

  const runtimeConfig = await getUnlockRuntimeConfig();
  const reclaimAmount = runtimeConfig.incentiveAmount;
  try {
    const burn = await burnCredits({
      actorId: actorUserId,
      targetUserId: submission.userId,
      amount: reclaimAmount,
      burnReason: 'unlock_reward_revoked_duplicate_identity',
      governanceTicketId: `unlock:revoke:submission:${submissionId}`,
      idempotencyKey: `unlock-revoke-submission-${submissionId}`,
    });
    await insertServiceCreditsAudit({
      actorId: actorUserId,
      command: 'service-credits.governance.burn.unlock.revoke',
      policyStatus: 'allow',
      reason: 'unlock_reward_revoked',
      targetType: 'governance_event',
      targetId: burn.governanceEventId,
      metadata: { unlockSubmissionId: submissionId, targetUserId: submission.userId, amount: reclaimAmount },
    });
    return { creditsReclaimed: true, reclaimAmount };
  } catch (burnError) {
    // Leave creditsReclaimed false; the access revocation below still proceeds. Surface for diagnosis.
    reportError(burnError, { area: 'unlock', op: 'admin_submissions_submissionid_revoke_burn', extra: { submissionId } });
    return { creditsReclaimed: false, reclaimAmount };
  }
}

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

  const requestId = resolveUnlockRequestId(request);

  const resolvedParams = await params;
  const parsedId = parseSubmissionId(resolvedParams.submissionId);
  if (!parsedId.ok) {
    return parsedId.response;
  }
  const { submissionId } = parsedId;

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

    const { creditsReclaimed, reclaimAmount } = await reclaimUnlockReward(existing, gate.auth.userId, submissionId);

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
      requestId,
      metadata: { submissionId, creditsReclaimed, reclaimAmount },
    });

    return NextResponse.json({ ok: true, submission, creditsReclaimed, reclaimAmount });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_submissionid_revoke' });
    return unlockErrorResponse('Unlock reward revoke unavailable.', 503);
  }
}
