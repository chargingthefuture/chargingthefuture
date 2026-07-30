import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { insertUnlockAudit, reviewUnlockSubmission } from 'lib/unlock/repository';
import { grantUnlockRewardForSubmission } from 'lib/unlock/reconcile-rewards';
import { insertServiceCreditsAudit } from 'lib/service-credits/repository';
import { grantUnleashFlagForUser } from 'lib/feature-flags/unleash-admin';
import { getAccountRestrictionStatus, restrictAccount, unrestrictAccount } from 'lib/auth/account-restrictions';
import { UNLOCK_SPAM_RESTRICTION_REASON } from 'lib/unlock/spam-denylist';
import { UNLOCK_FLAGS } from '@ctf/shared';
import type { ReviewUnlockSubmissionInput } from 'lib/unlock/types';
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

    // Platform-wide access on a spam decision. Dropping the Unlock tier to locked_support_only (done
    // above) still leaves a spammed member inside the Commons/support surfaces and every
    // 'any_authenticated' route. Spam means "not a real member" — so also place a full-account
    // ('all'-scope) restriction, which the auth gate enforces across every product surface. The
    // member can still reach their own status and account/data-deletion routes ('any_authenticated'),
    // which the restriction gate intentionally leaves open. A later non-spam decision lifts it below.
    if (body.reviewStatus === 'spam') {
      await restrictAccount({
        targetUserId: submission.userId,
        actorId: gate.auth.userId,
        scope: 'all',
        reason: UNLOCK_SPAM_RESTRICTION_REASON,
      });
    } else {
      // Approved or rejected: undo a restriction we placed for spam so the member regains the access
      // their new tier grants. Only lift a restriction that carries our spam marker — never one an
      // admin set for an unrelated reason.
      const restriction = await getAccountRestrictionStatus(submission.userId, 'all');
      if (restriction.isRestricted && restriction.reason === UNLOCK_SPAM_RESTRICTION_REASON) {
        await unrestrictAccount({ targetUserId: submission.userId, actorId: gate.auth.userId });
      }
    }

    let rewardWithheld = false;
    if (body.reviewStatus === 'approved') {
      // The verification decision is already committed above. The flag grant and the
      // ServiceCredits reward are best-effort follow-ups: if a provider (Unleash admin
      // API, Formance ledger) is temporarily unavailable, that must NOT fail the approval.
      // The mint is idempotent, so a later retry won't double-grant.
      try {
        // Grant the Unleash flag for this user so flag-based evaluation returns true on
        // subsequent requests without requiring a DB lookup. Best-effort: if the Admin API
        // is unavailable, the DB fallback in isUserUnlocked() remains authoritative.
        await grantUnleashFlagForUser(UNLOCK_FLAGS.QUORA_ONBOARDING, submission.userId);

        // Skip if this submission's reward already landed or was clawed back. Otherwise grant through the
        // shared duplicate-identity guard: if another account already holds this Quora identity's reward,
        // the reward is HELD for an admin determination instead of minting a second one for the same person.
        if (!submission.incentiveGrantedAt && !submission.rewardRevokedAt) {
          const outcome = await grantUnlockRewardForSubmission(submission);
          if (outcome.status === 'granted') {
            await insertServiceCreditsAudit({
              actorId: gate.auth.userId,
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
            rewardWithheld = true;
          }
        }
      } catch (incentiveError) {
        reportError(incentiveError, { area: 'unlock', op: 'admin_submissions_submissionid_review_incentive', extra: { submissionId } });
      }
    }

    return NextResponse.json({ ok: true, submission, rewardWithheld });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_submissionid_review' });
    return unlockErrorResponse('Unlock submission review unavailable.', 503);
  }
}
