import { NextResponse } from 'next/server';
import { normalizeQuoraProfileUrl, requireUnlockUserAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { createOrUpdateUnlockSubmission, insertUnlockAudit } from 'lib/unlock/repository';
import { isUnlockEarlyCommonsEnabled } from 'lib/unlock/access';
import { restrictAccount } from 'lib/auth/account-restrictions';
import { UNLOCK_SPAM_DENYLIST_ACTOR, UNLOCK_SPAM_RESTRICTION_REASON } from 'lib/unlock/spam-denylist';
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
  // Experiment bucket, recorded on the submit audit so the completion rate can be compared between
  // the early-Commons treatment group and the control group. Defaults to control when the rollout is off.
  const experimentBucket = (await isUnlockEarlyCommonsEnabled(gate.auth.userId)) ? 'early_commons' : 'control';

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
      metadata: { experimentBucket },
    });
    return unlockErrorResponse('Valid Quora profile URL is required.', 400);
  }

  try {
    const submission = await createOrUpdateUnlockSubmission({
      userId: gate.auth.userId,
      quoraProfileUrl: body.quoraProfileUrl,
      quoraProfileUrlNormalized: normalizedUrl,
    });

    // The submitted URL is on the spam denylist, so the row was auto-marked spam instead of pending.
    // Apply the same app-wide block the admin spam path applies, so a spammer who deleted their data
    // and made a new account is shut out again without an admin ever re-reviewing them. Attributed to
    // the system (no admin acted). Best-effort: a retry re-applies it, and the restriction is idempotent.
    if (submission.reviewStatus === 'spam') {
      try {
        await restrictAccount({
          targetUserId: gate.auth.userId,
          actorId: UNLOCK_SPAM_DENYLIST_ACTOR,
          scope: 'all',
          reason: UNLOCK_SPAM_RESTRICTION_REASON,
        });
      } catch (restrictionError) {
        reportError(restrictionError, { area: 'unlock', op: 'submission_denylist_restrict' });
      }
    }

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.verification.submit',
      policyStatus: submission.reviewStatus === 'spam' ? 'deny' : 'allow',
      reason: submission.reviewStatus === 'spam' ? 'spam_denylisted' : 'ok',
      targetUserId: gate.auth.userId,
      requestId,
      metadata: { submissionId: submission.id, experimentBucket },
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
