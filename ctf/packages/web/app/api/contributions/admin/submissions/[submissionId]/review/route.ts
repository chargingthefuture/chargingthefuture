import { NextResponse } from 'next/server';
import {
  contributionsErrorResponse,
  ensureMutationCsrf,
  isUuid,
  requireContributionsAdminAccess,
} from '../../../../_lib';
import { insertContributionsAudit, reviewSubmission } from 'lib/contributions/repository';

type RouteParams = {
  params: Promise<{
    submissionId: string;
  }>;
};

type ReviewBody = {
  action?: 'confirm' | 'reject';
  confirmedAmountUsd?: number;
  reviewNote?: string;
};

export async function POST(request: Request, { params }: RouteParams) {
  const gate = await requireContributionsAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { submissionId } = await params;
  if (!isUuid(submissionId)) {
    return NextResponse.json({ ok: false, code: 'contributions_invalid_payload', message: 'submissionId must be a UUID.' }, { status: 400 });
  }

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ ok: false, code: 'contributions_invalid_payload', message: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (body.action !== 'confirm' && body.action !== 'reject') {
    return NextResponse.json(
      { ok: false, code: 'contributions_invalid_payload', message: 'action must be confirm or reject.' },
      { status: 400 },
    );
  }

  try {
    const submission = await reviewSubmission({
      actorUserId: gate.auth.userId,
      submissionId,
      action: body.action,
      confirmedAmountUsd: body.confirmedAmountUsd,
      reviewNote: body.reviewNote,
    });

    if (!submission) {
      return NextResponse.json({ ok: false, code: 'contributions_not_found', message: 'Contribution not found.' }, { status: 404 });
    }

    // Audit metadata deliberately excludes signal_contact (personal data).
    await insertContributionsAudit({
      actorUserId: gate.auth.userId,
      action: body.action === 'confirm' ? 'contributions.admin.submission.confirm' : 'contributions.admin.submission.reject',
      targetSubmissionId: submission.id,
      metadata: {
        kind: submission.kind,
        confirmedAmountUsd: submission.confirmedAmountUsd,
        creditsGranted: submission.creditsGranted,
        creditGovernanceEventId: submission.creditGovernanceEventId,
        cycleId: submission.cycleId,
      },
    });

    return NextResponse.json({ ok: true, submission });
  } catch (error) {
    return contributionsErrorResponse(error, 'Contribution review unavailable.', 'admin_submission_review');
  }
}
