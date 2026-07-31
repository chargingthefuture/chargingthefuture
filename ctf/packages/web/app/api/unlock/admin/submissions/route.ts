import { NextResponse } from 'next/server';
import { requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { insertUnlockAudit, listUnlockSubmissions } from 'lib/unlock/repository';
import type { UnlockAccessTier, UnlockReviewStatus } from 'lib/unlock/types';
import { reportError } from 'lib/observability/report';

const ALLOWED_REVIEW_STATUSES = new Set<UnlockReviewStatus>(['pending', 'approved', 'rejected', 'spam']);
const ALLOWED_ACCESS_TIERS = new Set<UnlockAccessTier>(['pending_readonly', 'locked_support_only', 'approved_full']);

type SubmissionFilters = {
  reviewStatus: UnlockReviewStatus | undefined;
  accessTier: UnlockAccessTier | undefined;
  limit: number;
};

// Parse and validate the queue filters from the query string. Returns the narrowed filters passed
// to the repository plus the raw candidate strings that the audit metadata logs verbatim, so the
// audit record keeps logging exactly what the caller sent (including an empty string).
type ParsedFilters =
  | {
      ok: true;
      filters: SubmissionFilters;
      reviewStatusCandidate: string | null;
      accessTierCandidate: string | null;
    }
  | { ok: false; response: ReturnType<typeof unlockErrorResponse> };

function parseSubmissionFilters(url: URL): ParsedFilters {
  const reviewStatusCandidate = url.searchParams.get('reviewStatus');
  const accessTierCandidate = url.searchParams.get('accessTier');
  const limitCandidate = Number(url.searchParams.get('limit') ?? 100);

  if (reviewStatusCandidate && !ALLOWED_REVIEW_STATUSES.has(reviewStatusCandidate as UnlockReviewStatus)) {
    return { ok: false, response: unlockErrorResponse('Invalid reviewStatus filter.', 400) };
  }

  if (accessTierCandidate && !ALLOWED_ACCESS_TIERS.has(accessTierCandidate as UnlockAccessTier)) {
    return { ok: false, response: unlockErrorResponse('Invalid accessTier filter.', 400) };
  }

  return {
    ok: true,
    filters: {
      reviewStatus: reviewStatusCandidate ? (reviewStatusCandidate as UnlockReviewStatus) : undefined,
      accessTier: accessTierCandidate ? (accessTierCandidate as UnlockAccessTier) : undefined,
      limit: Number.isFinite(limitCandidate) ? limitCandidate : 100,
    },
    reviewStatusCandidate,
    accessTierCandidate,
  };
}

export async function GET(request: Request) {
  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  const parsed = parseSubmissionFilters(new URL(request.url));
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const submissions = await listUnlockSubmissions(parsed.filters);

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.submission.list',
      policyStatus: 'allow',
      reason: 'ok',
      requestId,
      metadata: {
        reviewStatus: parsed.reviewStatusCandidate,
        accessTier: parsed.accessTierCandidate,
        count: submissions.length,
      },
    });

    return NextResponse.json({ ok: true, submissions });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions' });
    return unlockErrorResponse('Unlock submission queue unavailable.', 503);
  }
}
