import { NextResponse } from 'next/server';
import { normalizeQuoraProfileUrl, requireUnlockUserAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { createOrUpdateUnlockSubmission, insertUnlockAudit } from 'lib/unlock/repository';
import { reportError } from 'lib/observability/report';

type SubmissionBody = {
  quoraProfileUrl?: string;
};

export async function POST(request: Request) {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  let body: SubmissionBody;
  try {
    body = (await request.json()) as SubmissionBody;
  } catch {
    return unlockErrorResponse('Invalid JSON payload.', 400);
  }

  if (!body.quoraProfileUrl || typeof body.quoraProfileUrl !== 'string') {
    return unlockErrorResponse('quoraProfileUrl is required.', 400);
  }

  const normalizedUrl = normalizeQuoraProfileUrl(body.quoraProfileUrl);
  if (!normalizedUrl) {
    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.verification.submit',
      policyStatus: 'deny',
      reason: 'invalid_quora_url',
      targetUserId: gate.auth.userId,
      requestId,
      metadata: {},
    });
    return unlockErrorResponse('Valid Quora profile URL is required.', 400);
  }

  try {
    const submission = await createOrUpdateUnlockSubmission({
      userId: gate.auth.userId,
      quoraProfileUrl: body.quoraProfileUrl,
      quoraProfileUrlNormalized: normalizedUrl,
    });

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.verification.submit',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: gate.auth.userId,
      requestId,
      metadata: { submissionId: submission.id },
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'submission' });
    // Surface the real cause in server logs (a swallowed error here made the 503
    // undiagnosable). The client message stays generic so DB internals never leak.
    console.error('[unlock] submission failed', error);
    return unlockErrorResponse('Unlock submission unavailable.', 503);
  }
}
