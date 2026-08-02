import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { insertUnlockAudit, reviewUnlockSubmission } from 'lib/unlock/repository';
import { grantUnlockRewardForSubmission } from 'lib/unlock/reconcile-rewards';
import { insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { grantUnleashFlagForUser } from 'lib/feature-flags';
import { getAccountRestrictionStatus, restrictAccount, unrestrictAccount } from 'lib/auth/account-restrictions';
import { UNLOCK_SPAM_RESTRICTION_REASON } from 'lib/unlock/spam-denylist';
import { UNLOCK_FLAGS } from '@ctf/shared';
import type { ReviewUnlockSubmissionInput, UnlockSubmission } from 'lib/unlock/types';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{
    submissionId: string;
  }>;
};

type ReviewBody = {
  reviewStatus?: ReviewUnlockSubmissionInput['reviewStatus'];
  reviewNote?: string;
};

const ALLOWED_REVIEW_STATUSES = new Set<ReviewUnlockSubmissionInput['reviewStatus']>(['approved', 'rejected', 'spam']);

// Keep the platform-wide account restriction in step with the review decision. A spam decision places a
// full-account ('all'-scope) restriction — dropping the Unlock tier to locked_support_only alone still
// leaves a spammed member inside the Commons/support surfaces and every 'any_authenticated' route, so the
// restriction is what actually removes them from the app (their own status and account/data-deletion
// routes stay reachable). Approved/rejected lifts a restriction only when it carries our spam marker, so
// an unrelated admin restriction is never disturbed.
async function syncSpamAccountRestriction(
  targetUserId: string,
  reviewStatus: ReviewUnlockSubmissionInput['reviewStatus'],
  actorUserId: string,
): Promise<void> {
  if (reviewStatus === 'spam') {
    await restrictAccount({ targetUserId, actorId: actorUserId, scope: 'all', reason: UNLOCK_SPAM_RESTRICTION_REASON });
    return;
  }
  const restriction = await getAccountRestrictionStatus(targetUserId, 'all');
  if (restriction.isRestricted && restriction.reason === UNLOCK_SPAM_RESTRICTION_REASON) {
    await unrestrictAccount({ targetUserId, actorId: actorUserId });
  }
}

// Best-effort follow-ups after an approval decision (already committed). The Unleash flag grant and the
// ServiceCredits reward must NOT fail the approval if a provider (Unleash admin API, Formance ledger) is
// temporarily unavailable — the mint is idempotent, so a later retry won't double-grant. Returns whether
// the reward was HELD by the duplicate-identity guard (another account holds this Quora identity's reward).
async function grantApprovalRewardBestEffort(
  submission: UnlockSubmission,
  actorUserId: string,
  submissionId: number,
  reviewStatus: ReviewUnlockSubmissionInput['reviewStatus'],
): Promise<boolean> {
  if (reviewStatus !== 'approved') {
    return false;
  }
  try {
    // Grant the Unleash flag so flag-based evaluation returns true on subsequent requests without a DB
    // lookup. Best-effort: if the Admin API is unavailable, the DB fallback in isUserUnlocked() is authoritative.
    await grantUnleashFlagForUser(UNLOCK_FLAGS.QUORA_ONBOARDING, submission.userId);

    // Skip if this submission's reward already landed or was clawed back. Otherwise grant through the shared
    // duplicate-identity guard: if another account already holds this Quora identity's reward, the reward is
    // HELD for an admin determination instead of minting a second one for the same person.
    if (!submission.incentiveGrantedAt && !submission.rewardRevokedAt) {
      const outcome = await grantUnlockRewardForSubmission(submission);
      if (outcome.status === 'granted') {
        await insertServiceCreditsAudit({
          actorId: actorUserId,
          command: 'service-credits.governance.mint.grant.unlock',
          policyStatus: 'allow',
          reason: 'unlock_approved_reward',
          targetType: 'governance_event',
          targetId: outcome.governanceEventId,
          metadata: {
            unlockSubmissionId: submission.id,
            targetUserId: submission.userId,
            amount: outcome.amount,
          },
        });
      } else if (outcome.status === 'withheld') {
        return true;
      }
    }
  } catch (incentiveError) {
    reportError(incentiveError, { area: 'unlock', op: 'admin_submissions_submissionid_review_incentive', extra: { submissionId } });
  }
  return false;
}

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
  const submissionId = Number(resolvedParams.submissionId);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return unlockErrorResponse('submissionId must be a positive integer.', 400);
  }

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return unlockErrorResponse('Invalid JSON payload.', 400);
  }

  if (!body.reviewStatus || !ALLOWED_REVIEW_STATUSES.has(body.reviewStatus)) {
    return unlockErrorResponse('reviewStatus must be approved, rejected, or spam.', 400);
  }

  try {
    const submission = await reviewUnlockSubmission({
      actorUserId: gate.auth.userId,
      submissionId,
      reviewStatus: body.reviewStatus,
      reviewNote: body.reviewNote,
    });

    if (!submission) {
      return unlockErrorResponse('Unlock submission not found.', 404);
    }

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.submission.review',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: submission.userId,
      requestId,
      metadata: {
        submissionId,
        reviewStatus: body.reviewStatus,
      },
    });

    await syncSpamAccountRestriction(submission.userId, body.reviewStatus, gate.auth.userId);

    const rewardWithheld = await grantApprovalRewardBestEffort(submission, gate.auth.userId, submissionId, body.reviewStatus);

    return NextResponse.json({ ok: true, submission, rewardWithheld });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_submissionid_review' });
    return unlockErrorResponse('Unlock submission review unavailable.', 503);
  }
}
