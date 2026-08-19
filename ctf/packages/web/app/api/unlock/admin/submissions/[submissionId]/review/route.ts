import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { insertUnlockAudit, reviewUnlockSubmission } from 'lib/unlock/repository';
import { grantUnlockRewardForSubmission } from 'lib/unlock/reconcile-rewards';
import { insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { grantUnleashFlagForUser } from 'lib/feature-flags';
import { getAccountRestrictionStatus, restrictAccount, unrestrictAccount } from 'lib/auth/account-restrictions';
import {
  UNLOCK_DUPLICATE_RESTRICTION_REASON,
  UNLOCK_RESTRICTION_REASONS,
  UNLOCK_SPAM_RESTRICTION_REASON,
} from 'lib/unlock/spam-denylist';
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

const ALLOWED_REVIEW_STATUSES = new Set<ReviewUnlockSubmissionInput['reviewStatus']>([
  'approved',
  'rejected',
  'spam',
  'duplicate',
]);

// The decisions that remove the member from the app, and the restriction marker each one writes. Both
// place the same platform-wide block; they are told apart only so the member can be told which it was —
// a duplicate is a real person who should go and sign in with their original account, and telling them
// so is the difference between a dead end and a fixable mistake.
const BLOCKING_DECISIONS: Partial<Record<ReviewUnlockSubmissionInput['reviewStatus'], string>> = {
  spam: UNLOCK_SPAM_RESTRICTION_REASON,
  duplicate: UNLOCK_DUPLICATE_RESTRICTION_REASON,
};

// Keep the platform-wide account restriction in step with the review decision. A spam or duplicate
// decision places a full-account ('all'-scope) restriction — dropping the Unlock tier to
// locked_support_only alone still leaves the member inside the Commons/support surfaces and every
// 'any_authenticated' route, so the restriction is what actually removes them from the app (their own
// status and account/data-deletion routes stay reachable, which is what lets them delete this identity).
// Approved/rejected lifts a restriction only when it carries one of our own markers, so an unrelated
// admin restriction is never disturbed.
async function syncUnlockAccountRestriction(
  targetUserId: string,
  reviewStatus: ReviewUnlockSubmissionInput['reviewStatus'],
  actorUserId: string,
): Promise<void> {
  const blockingReason = BLOCKING_DECISIONS[reviewStatus];
  if (blockingReason) {
    await restrictAccount({ targetUserId, actorId: actorUserId, scope: 'all', reason: blockingReason });
    return;
  }
  const restriction = await getAccountRestrictionStatus(targetUserId, 'all');
  if (restriction.isRestricted && UNLOCK_RESTRICTION_REASONS.includes(restriction.reason ?? '')) {
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

    await syncUnlockAccountRestriction(submission.userId, body.reviewStatus, gate.auth.userId);

    const rewardWithheld = await grantApprovalRewardBestEffort(submission, gate.auth.userId, submissionId, body.reviewStatus);

    return NextResponse.json({ ok: true, submission, rewardWithheld });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_submissionid_review' });
    return unlockErrorResponse('Unlock submission review unavailable.', 503);
  }
}
