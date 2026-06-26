import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, normalizeQuoraProfileUrl, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { insertUnlockAudit, updateUnlockSubmissionQuoraUrl } from 'lib/unlock/repository';
import { reportError } from 'lib/observability/report';

type RouteParams = {
  params: Promise<{
    submissionId: string;
  }>;
};

type EditUrlBody = {
  quoraProfileUrl?: string;
};

// Admin correction of a submission's Quora profile URL (e.g. fixing a typo a member submitted).
// Re-runs the same validation and normalization as the member submission path so the stored
// normalized URL stays canonical. Does not change review status or the verification window.
export async function PATCH(request: Request, { params }: RouteParams) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  const resolvedParams = await params;
  const submissionId = Number(resolvedParams.submissionId);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return unlockErrorResponse('submissionId must be a positive integer.', 400);
  }

  let body: EditUrlBody;
  try {
    body = (await request.json()) as EditUrlBody;
  } catch {
    return unlockErrorResponse('Invalid JSON payload.', 400);
  }

  if (!body.quoraProfileUrl || typeof body.quoraProfileUrl !== 'string') {
    return unlockErrorResponse('quoraProfileUrl is required.', 400);
  }

  const normalizedUrl = normalizeQuoraProfileUrl(body.quoraProfileUrl);
  if (!normalizedUrl) {
    return unlockErrorResponse('Valid Quora profile URL is required.', 400);
  }

  try {
    const submission = await updateUnlockSubmissionQuoraUrl(submissionId, body.quoraProfileUrl, normalizedUrl);

    if (!submission) {
      return unlockErrorResponse('Unlock submission not found.', 404);
    }

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.submission.url.edit',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: submission.userId,
      requestId,
      metadata: {
        submissionId,
        quoraProfileUrlNormalized: normalizedUrl,
      },
    });

    return NextResponse.json({ ok: true, submission });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_submissions_submissionid_url_edit' });
    return unlockErrorResponse('Unlock submission update unavailable.', 503);
  }
}
