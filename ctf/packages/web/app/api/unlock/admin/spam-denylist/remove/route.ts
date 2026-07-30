import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { removeSpamQuoraUrl } from 'lib/unlock/spam-denylist';
import { reportError } from 'lib/observability/report';

type RemoveBody = {
  quoraProfileUrlNormalized?: string;
};

// Admin action: drop a URL from the spam denylist. This only stops FUTURE submissions of that URL from
// being auto-blocked; it does not lift the app restriction on any member already blocked for it (that is
// reversed by re-reviewing their submission to approved/rejected). Admin-gated + CSRF-guarded + audited.
export async function POST(request: Request) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  let body: RemoveBody;
  try {
    body = (await request.json()) as RemoveBody;
  } catch {
    return unlockErrorResponse('Invalid JSON payload.', 400);
  }

  const normalized = body.quoraProfileUrlNormalized?.trim();
  if (!normalized) {
    return unlockErrorResponse('quoraProfileUrlNormalized is required.', 400);
  }

  try {
    await removeSpamQuoraUrl(normalized);

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.spam_denylist.remove',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: gate.auth.userId,
      requestId,
      metadata: { quoraProfileUrlNormalized: normalized },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    reportError(error, { area: 'unlock', op: 'admin_spam_denylist_remove' });
    return unlockErrorResponse('Spam denylist update unavailable.', 503);
  }
}
