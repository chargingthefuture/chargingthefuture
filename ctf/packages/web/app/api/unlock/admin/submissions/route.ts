import { NextResponse } from 'next/server';
import { requireUnlockAdminAccess, unlockErrorResponse } from 'lib/unlock/_lib';
import { reportError } from 'lib/observability/report';
import { insertUnlockAudit, listUnlockSubmissions } from 'lib/unlock/repository';
import type { UnlockAccessTier, UnlockReviewStatus } from 'lib/unlock/types';

const ALLOWED_REVIEW_STATUSES = new Set<UnlockReviewStatus>(['pending', 'approved', 'rejected', 'spam']);
const ALLOWED_ACCESS_TIERS = new Set<UnlockAccessTier>(['pending_readonly', 'locked_support_only', 'approved_full']);

export async function GET(request: Request) {
  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const reviewStatusCandidate = url.searchParams.get('reviewStatus');
  const accessTierCandidate = url.searchParams.get('accessTier');
  const limitCandidate = Number(url.searchParams.get('limit') ?? 100);

  if (reviewStatusCandidate && !ALLOWED_REVIEW_STATUSES.has(reviewStatusCandidate as UnlockReviewStatus)) {
    return unlockErrorResponse('Invalid reviewStatus filter.', 400);
  }

  if (accessTierCandidate && !ALLOWED_ACCESS_TIERS.has(accessTierCandidate as UnlockAccessTier)) {
    return unlockErrorResponse('Invalid accessTier filter.', 400);
  }

  try {
    const submissions = await listUnlockSubmissions({
      reviewStatus: reviewStatusCandidate ? (reviewStatusCandidate as UnlockReviewStatus) : undefined,
      accessTier: accessTierCandidate ? (accessTierCandidate as UnlockAccessTier) : undefined,
      limit: Number.isFinite(limitCandidate) ? limitCandidate : 100,
    });

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.submission.list',
      policyStatus: 'allow',
      reason: 'ok',
      metadata: {
        reviewStatus: reviewStatusCandidate,
        accessTier: accessTierCandidate,
        count: submissions.length,
      },
    });

    return NextResponse.json({ ok: true, submissions });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'get_admin_submissions', extra: { userId: gate.auth.userId } });
    return unlockErrorResponse('Unlock submission queue unavailable.', 503);
  }
}
