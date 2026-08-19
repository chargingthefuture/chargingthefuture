import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockUserAccess, resolveUnlockRequestId } from 'lib/unlock/_lib';
import { recordUnlockHelpRequest } from 'lib/unlock/help-requests';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { failureResponse } from 'lib/errors/failure';

// "I can't do this step — let me ask somebody." Pressing that on the Unlock screen records the member
// here, which is what gives them the Commons (support-only) on their very next page load, so there is
// somebody to ask. Until this existed, the only place to get help with the Quora step sat behind the
// step itself.
//
// Signed-in members only, and self-scoped: the member id comes from the session, never from the body,
// so this can only ever open the Commons to the person who pressed the button. It grants nothing else —
// approved-only surfaces stay closed, and the Commons still shows them the verification banner.
// Idempotent: pressing twice keeps the first timestamp.
export async function POST(request: Request) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  // `any_authenticated`, deliberately: the whole point is that this member has no access tier yet.
  const gate = await requireUnlockUserAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const requestId = resolveUnlockRequestId(request);

  try {
    await recordUnlockHelpRequest(gate.auth.userId);

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.help.request',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: gate.auth.userId,
      requestId,
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return failureResponse({
      summary: 'Could not open the Commons for you',
      error,
      code: 'unlock_help_request_failed',
      area: 'unlock',
      op: 'help_request',
      audience: 'member',
    });
  }
}
