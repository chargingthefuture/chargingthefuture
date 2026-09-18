import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockUserAccess, resolveUnlockRequestId } from 'lib/unlock/_lib';
import { recordUnlockHelpRequest } from 'lib/unlock/help-requests';
import { normalizeUnlockQuoraHint } from 'lib/unlock/quora-hint';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { failureResponse } from 'lib/errors/failure';

// "I can't do this step — let me ask somebody." Pressing that on the Unlock screen records the member
// here, which is what gives them the Commons (support-only) on their very next page load, so there is
// somebody to ask. Until this existed, the only place to get help with the Quora step sat behind the
// step itself.
//
// The request may also carry whatever the member could say about their Quora account when they could
// not give the URL — a name, a link to something they posted, the email they joined with. Optional, and
// free text: somebody who could produce a well-formed URL would have used the field above this one, so
// there is nothing to validate it against. Without it, the members who most need a manual approval were
// the ones who left nothing behind to approve.
//
// Signed-in members only, and self-scoped: the member id comes from the session, never from the body,
// so this can only ever open the Commons to the person who pressed the button. It grants nothing else —
// approved-only surfaces stay closed, and the Commons still shows them the verification banner.
// Idempotent: pressing twice keeps the first timestamp, and a later press that carries a hint stores it.
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

  // The body is optional in both directions: the button used to send none at all, and a member who
  // presses it without filling the box sends an empty one. Neither is an error — the request still
  // opens the Commons, which is what the button is for.
  const body = (await request.json().catch(() => null)) as { quoraHint?: unknown } | null;
  const quoraHint = normalizeUnlockQuoraHint(body?.quoraHint);

  try {
    await recordUnlockHelpRequest(gate.auth.userId, quoraHint);

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.help.request',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: gate.auth.userId,
      requestId,
      // Whether they left something to look them up by, not the text itself: the hint is member data
      // and belongs in the one row an account deletion removes, not copied into the audit log as well.
      metadata: { hintGiven: quoraHint !== null },
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
