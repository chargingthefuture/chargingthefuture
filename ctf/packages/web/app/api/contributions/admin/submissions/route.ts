import { NextResponse } from 'next/server';
import { contributionsErrorResponse, requireContributionsAdminAccess } from '../../_lib';
import {
  CONTRIBUTION_STATUSES,
  insertContributionsAudit,
  listSubmissions,
} from 'lib/contributions/repository';
import type { ContributionStatus } from 'lib/contributions/types';

export async function GET(request: Request) {
  const gate = await requireContributionsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const url = new URL(request.url);
  const statusCandidate = url.searchParams.get('status');
  const limitCandidate = Number(url.searchParams.get('limit') ?? 100);

  if (statusCandidate && !CONTRIBUTION_STATUSES.includes(statusCandidate as ContributionStatus)) {
    return NextResponse.json(
      { ok: false, code: 'contributions_invalid_payload', message: 'status must be pending, confirmed, or rejected.' },
      { status: 400 },
    );
  }

  try {
    const submissions = await listSubmissions({
      status: statusCandidate ? (statusCandidate as ContributionStatus) : undefined,
      limit: Number.isFinite(limitCandidate) ? limitCandidate : 100,
    });

    await insertContributionsAudit({
      actorUserId: gate.auth.userId,
      action: 'contributions.admin.submission.list',
      metadata: { status: statusCandidate, count: submissions.length },
    });

    return NextResponse.json({ ok: true, submissions });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution queue unavailable.', 'admin_submissions_list');
  }
}
