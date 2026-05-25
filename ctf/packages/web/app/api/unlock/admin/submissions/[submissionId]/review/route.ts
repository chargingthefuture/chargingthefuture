import { NextResponse } from 'next/server';
import { requireUnlockAdminAccess, unlockErrorResponse } from 'lib/unlock/_lib';
import { getUnlockRuntimeConfig, insertUnlockAudit, markUnlockIncentiveGranted, reviewUnlockSubmission } from 'lib/unlock/repository';
import { insertServiceCreditsAudit, mintGrant } from 'lib/service-credits/repository';
import { grantUnleashFlagForUser } from 'lib/feature-flags/unleash-admin';
import { UNLOCK_FLAGS } from '@ctf/shared';
import type { ReviewUnlockSubmissionInput } from 'lib/unlock/types';

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
      // Grant the Unleash flag for this user so flag-based evaluation returns true on
      // subsequent requests without requiring a DB lookup. Best-effort: if the Admin API
      // is unavailable, the DB fallback in isUserUnlocked() remains authoritative.
      await grantUnleashFlagForUser(UNLOCK_FLAGS.QUORA_ONBOARDING, submission.userId);
    }

    if (body.reviewStatus === 'approved' && !submission.incentiveGrantedAt) {
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

    return NextResponse.json({ ok: true, submission });
  } catch {
    return unlockErrorResponse('Unlock submission review unavailable.', 503);
  }
}
