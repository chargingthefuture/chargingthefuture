import { NextResponse } from 'next/server';
import {
  auditBestEffort,
  contributionsErrorResponse,
  ensureMutationCsrf,
  isUuid,
  parseJsonObject,
  requireContributionsAdminAccess,
} from '../../../../_lib';
import { reviewSubmission } from 'lib/contributions/repository';

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

  const parsed = await parseJsonObject(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  const body = parsed.body as ReviewBody;

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
    await auditBestEffort('admin_submission_review', {
      actorUserId: gate.auth.userId,
      action: body.action === 'confirm' ? 'contributions.admin.submission.confirm' : 'contributions.admin.submission.reject',
      targetSubmissionId: submission.id,
      metadata: {
        // The reviewed member — required by the audit contract's targetContext for
        // contributions.admin.submission.confirm / .reject.
        targetUserId: submission.userId,
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
