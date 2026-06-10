import { NextResponse } from 'next/server';
import { auditBestEffort, contributionsErrorResponse, requireContributionsAdminAccess } from '../../_lib';
import { CONTRIBUTION_STATUSES, listSubmissions } from 'lib/contributions/repository';
import type { ContributionStatus } from 'lib/contributions/types';

const SUBMISSIONS_LIMIT_DEFAULT = 100;
const SUBMISSIONS_LIMIT_MAX = 100;

export async function GET(request: Request) {
  const gate = await requireContributionsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const statusCandidate = url.searchParams.get('status');

  if (statusCandidate && !CONTRIBUTION_STATUSES.includes(statusCandidate as ContributionStatus)) {
    return NextResponse.json(
      { ok: false, code: 'contributions_invalid_payload', message: 'status must be pending, confirmed, or rejected.' },
      { status: 400 },
    );
  }

  // limit is optional; when present it must be a positive integer. Clamp to the max so a
  // caller can never ask for an unbounded page.
  let limit = SUBMISSIONS_LIMIT_DEFAULT;
  const rawLimit = url.searchParams.get('limit');
  if (rawLimit !== null) {
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return NextResponse.json(
        { ok: false, code: 'contributions_invalid_payload', message: 'limit must be a positive integer.' },
        { status: 400 },
      );
    }
    limit = Math.min(parsedLimit, SUBMISSIONS_LIMIT_MAX);
  }

  try {
    const submissions = await listSubmissions({
      status: statusCandidate ? (statusCandidate as ContributionStatus) : undefined,
      limit,
    });

    await auditBestEffort('admin_submissions_list', {
      actorUserId: gate.auth.userId,
      action: 'contributions.admin.submission.list',
      metadata: { status: statusCandidate, count: submissions.length },
    });

    return NextResponse.json({ ok: true, submissions });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution queue unavailable.', 'admin_submissions_list');
  }
}
