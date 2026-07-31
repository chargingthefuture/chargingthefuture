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

type ParsedSubmissionId =
  | { ok: true; submissionId: number }
  | { ok: false; response: ReturnType<typeof unlockErrorResponse> };

function parseSubmissionId(value: string): ParsedSubmissionId {
  const submissionId = Number(value);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return { ok: false, response: unlockErrorResponse('submissionId must be a positive integer.', 400) };
  }
  return { ok: true, submissionId };
}

// Parse the JSON body and run the same validation and normalization as the member submission path.
// Returns both the raw URL the caller sent (stored as-is) and its canonical normalized form.
type ParsedEditUrlBody =
  | { ok: true; rawUrl: string; normalizedUrl: string }
  | { ok: false; response: ReturnType<typeof unlockErrorResponse> };

async function parseEditUrlBody(request: Request): Promise<ParsedEditUrlBody> {
  let body: EditUrlBody;
  try {
    body = (await request.json()) as EditUrlBody;
  } catch {
    return { ok: false, response: unlockErrorResponse('Invalid JSON payload.', 400) };
  }

  if (!body.quoraProfileUrl || typeof body.quoraProfileUrl !== 'string') {
    return { ok: false, response: unlockErrorResponse('quoraProfileUrl is required.', 400) };
  }

  const normalizedUrl = normalizeQuoraProfileUrl(body.quoraProfileUrl);
  if (!normalizedUrl) {
    return { ok: false, response: unlockErrorResponse('Valid Quora profile URL is required.', 400) };
  }

  return { ok: true, rawUrl: body.quoraProfileUrl, normalizedUrl };
}

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
  const parsedId = parseSubmissionId(resolvedParams.submissionId);
  if (!parsedId.ok) {
    return parsedId.response;
  }
  const { submissionId } = parsedId;

  const parsedBody = await parseEditUrlBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const { rawUrl, normalizedUrl } = parsedBody;

  try {
    const submission = await updateUnlockSubmissionQuoraUrl(submissionId, rawUrl, normalizedUrl);

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
