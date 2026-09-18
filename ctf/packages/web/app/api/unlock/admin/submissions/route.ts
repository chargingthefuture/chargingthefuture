import { NextResponse } from 'next/server';
import {
  ensureUnlockMutationCsrf,
  normalizeQuoraProfileUrl,
  requireUnlockAdminAccess,
  resolveUnlockRequestId,
  unlockErrorResponse,
} from 'lib/unlock/_lib';
import { createOrUpdateUnlockSubmission, getUnlockSubmissionByUserId, insertUnlockAudit, listUnlockSubmissions } from 'lib/unlock/repository';
import { withMemberIdentities } from 'lib/unlock/member-identity';
import type { UnlockAccessTier, UnlockReviewStatus } from 'lib/unlock/types';
import { reportError } from 'lib/observability/report';

const ALLOWED_REVIEW_STATUSES = new Set<UnlockReviewStatus>([
  'pending',
  'approved',
  'rejected',
  'spam',
  'duplicate',
]);
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
    // Same reading as the admin page: the name comes from Clerk, not from any table of ours.
    const submissions = await withMemberIdentities(await listUnlockSubmissions(parsed.filters));

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

type CreateForMemberBody = {
  userId?: string;
  quoraProfileUrl?: string;
};

type ParsedCreateBody =
  | { ok: true; userId: string; rawUrl: string; normalizedUrl: string }
  | { ok: false; response: ReturnType<typeof unlockErrorResponse> };

// Validate the "enter this member's Quora URL for them" body. The URL goes through exactly the same
// normalization as the member's own submission, so an admin-entered URL is comparable with every
// other stored one — duplicate detection and the spam denylist both work off the normalized form.
async function parseCreateBody(request: Request): Promise<ParsedCreateBody> {
  let body: CreateForMemberBody;
  try {
    body = (await request.json()) as CreateForMemberBody;
  } catch {
    return { ok: false, response: unlockErrorResponse('Invalid JSON payload.', 400) };
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    return { ok: false, response: unlockErrorResponse('userId is required.', 400) };
  }

  if (!body.quoraProfileUrl || typeof body.quoraProfileUrl !== 'string') {
    return { ok: false, response: unlockErrorResponse('quoraProfileUrl is required.', 400) };
  }

  const normalizedUrl = normalizeQuoraProfileUrl(body.quoraProfileUrl);
  if (!normalizedUrl) {
    return { ok: false, response: unlockErrorResponse('Valid Quora profile URL is required.', 400) };
  }

  return { ok: true, userId, rawUrl: body.quoraProfileUrl, normalizedUrl };
}

// An admin enters a Quora URL for a member who never gave one.
//
// Some members cannot produce their own profile URL. They press "ask for help" on the Unlock screen,
// which admits them to the Commons and records whatever they could say about their Quora account — a
// name, a link to something they posted. An admin looks them up by hand and, until now, had nowhere to
// put what they found: the queue only ever showed members who had submitted, and the edit control sits
// on a submission card that does not exist for somebody with no submission. So the people who needed a
// manual approval were the ones who could not be approved.
//
// What this does NOT do is approve them. It creates the same pending submission the member would have
// created, so the ordinary review — read the profile, approve or reject — still happens on the queue
// card afterwards, with the same reward and duplicate handling as every other row. The row is stamped
// with the admin who entered it, so no reviewer can mistake it for the member's own claim, and the
// change is appended to the shared Quora URL history under that admin's id.
//
// Refuses when the member already has a submission: replacing a URL is the edit path on the card
// (PATCH .../[submissionId]), which keeps "add a missing one" and "change an existing one" as two
// separate decisions rather than letting one silently overwrite the other.
export async function POST(request: Request) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  const parsed = await parseCreateBody(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  const { userId, rawUrl, normalizedUrl } = parsed;

  try {
    const existing = await getUnlockSubmissionByUserId(userId);
    if (existing) {
      await insertUnlockAudit({
        actorUserId: gate.auth.userId,
        command: 'unlock.admin.submission.create',
        policyStatus: 'deny',
        reason: 'submission_exists',
        targetUserId: userId,
        requestId,
        metadata: { submissionId: existing.id },
      });
      return unlockErrorResponse(
        'This member already has a Quora URL on file. Use Edit on their card in the review queue to change it.',
        409,
      );
    }

    const submission = await createOrUpdateUnlockSubmission({
      userId,
      quoraProfileUrl: rawUrl,
      quoraProfileUrlNormalized: normalizedUrl,
      addedByAdminUserId: gate.auth.userId,
    });

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.submission.create',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: userId,
      requestId,
      metadata: {
        submissionId: submission.id,
        quoraProfileUrlNormalized: normalizedUrl,
        reviewStatus: submission.reviewStatus,
      },
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_create' });
    return unlockErrorResponse('Could not add that Quora URL for the member.', 503);
  }
}
