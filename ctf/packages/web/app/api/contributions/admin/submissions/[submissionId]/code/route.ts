import { NextResponse } from 'next/server';
import {
  auditBestEffort,
  contributionsErrorResponse,
  ensureMutationCsrf,
  isUuid,
  requireContributionsAdminAccess,
} from '../../../../_lib';
import { revealSubmissionCode } from 'lib/contributions/repository';

type RouteParams = {
  params: Promise<{
    submissionId: string;
  }>;
};

// Shows one claim's gift card code to the admin redeeming it. A POST so it is never prefetched or
// cached, and every reveal is audited, without the code.
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

  try {
    const revealed = await revealSubmissionCode(submissionId);
    if (!revealed.found) {
      return NextResponse.json({ ok: false, code: 'contributions_not_found', message: 'Contribution not found.' }, { status: 404 });
    }

    await auditBestEffort('admin_code_reveal', {
      actorUserId: gate.auth.userId,
      action: 'contributions.admin.code.reveal',
      targetSubmissionId: submissionId,
      metadata: { targetUserId: revealed.userId, revealed: revealed.ok },
    });

    if (!revealed.ok) {
      return NextResponse.json({ ok: false, code: 'contributions_code_unavailable', message: revealed.reason }, { status: 409 });
    }
    return NextResponse.json({ ok: true, code: revealed.code }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return contributionsErrorResponse(error, 'The gift card code could not be read.', 'admin_code_reveal');
  }
}
