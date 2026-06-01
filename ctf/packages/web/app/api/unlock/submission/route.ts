import { NextResponse } from 'next/server';
import { requireUnlockUserAccess, unlockErrorResponse } from 'lib/unlock/_lib';
import { createOrUpdateUnlockSubmission, insertUnlockAudit } from 'lib/unlock/repository';

type SubmissionBody = {
  quoraProfileUrl?: string;
};

function normalizeQuoraProfileUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (host !== 'quora.com' && host !== 'www.quora.com') {
      return null;
    }

    if (!parsed.pathname.startsWith('/profile/')) {
      return null;
    }

    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

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
      metadata: { submissionId: submission.id },
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (error) {
    // Surface the real cause in server logs (a swallowed error here made the 503
    // undiagnosable). The client message stays generic so DB internals never leak.
    console.error('[unlock] submission failed', error);
    return unlockErrorResponse('Unlock submission unavailable.', 503);
  }
}
