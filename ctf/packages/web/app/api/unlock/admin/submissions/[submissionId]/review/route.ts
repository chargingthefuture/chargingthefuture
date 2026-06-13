import { NextResponse } from 'next/server';
import { requireUnlockAdminAccess, unlockErrorResponse } from 'lib/unlock/_lib';
import { getUnlockRuntimeConfig, insertUnlockAudit, markUnlockIncentiveGranted, reviewUnlockSubmission } from 'lib/unlock/repository';
import { insertServiceCreditsAudit, mintGrant } from 'lib/service-credits/repository';
import { grantUnleashFlagForUser } from 'lib/feature-flags/unleash-admin';
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
  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

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
      metadata: {
        submissionId,
        reviewStatus: body.reviewStatus,
      },
    });

    if (body.reviewStatus === 'approved') {
      // The verification decision is already committed above. The flag grant and the
      // ServiceCredits incentive are best-effort follow-ups: if a provider (Unleash admin
      // API, Formance ledger) is temporarily unavailable, that must NOT fail the approval.
      // The mint is idempotent (idempotencyKey + markUnlockIncentiveGranted), so a later
      // retry won't double-grant.
      try {
        // Grant the Unleash flag for this user so flag-based evaluation returns true on
        // subsequent requests without requiring a DB lookup. Best-effort: if the Admin API
        // is unavailable, the DB fallback in isUserUnlocked() remains authoritative.
        await grantUnleashFlagForUser(UNLOCK_FLAGS.QUORA_ONBOARDING, submission.userId);

        if (!submission.incentiveGrantedAt) {
          const runtimeConfig = await getUnlockRuntimeConfig();
          const idempotencyKey = `unlock-approval-submission-${submission.id}`;
          const grant = await mintGrant({
            actorId: 'unlock-incentive-system',
            targetUserId: submission.userId,
            amount: runtimeConfig.incentiveAmount,
            grantReason: 'unlock_quora_verification_approval',
            governanceTicketId: `unlock:submission:${submission.id}`,
            idempotencyKey,
          });

          await markUnlockIncentiveGranted(submission.id);

          await insertServiceCreditsAudit({
            actorId: gate.auth.userId,
            command: 'service-credits.governance.mint.grant.unlock',
            policyStatus: 'allow',
            reason: 'unlock_approved_reward',
            targetType: 'governance_event',
            targetId: grant.governanceEventId,
            metadata: {
              unlockSubmissionId: submission.id,
              targetUserId: submission.userId,
              amount: runtimeConfig.incentiveAmount,
              idempotencyKey,
            },
          });
        }
      } catch (incentiveError) {
        reportError(incentiveError, { area: 'unlock', op: 'admin_submissions_submissionid_review_incentive', extra: { submissionId } });
      }
    }

    return NextResponse.json({ ok: true, submission });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_submissionid_review' });
    return unlockErrorResponse('Unlock submission review unavailable.', 503);
  }
}
