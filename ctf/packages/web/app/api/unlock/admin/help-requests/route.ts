import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { setUnlockHelpRequestDone } from 'lib/unlock/help-requests';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { failureResponse } from 'lib/errors/failure';

type DoneBody = { userId?: string; done?: boolean };

function parseDoneBody(raw: DoneBody): { ok: true; userId: string; done: boolean } | { ok: false; message: string } {
  const userId = raw.userId?.trim();
  if (!userId) return { ok: false, message: 'userId is required.' };
  if (typeof raw.done !== 'boolean') return { ok: false, message: 'done must be true (handled) or false (waiting again).' };
  return { ok: true, userId, done: raw.done };
}

// POST /api/unlock/admin/help-requests: an admin marks a member's "ask for help" request done (or
// waiting again) from their row in the sign-ups panel on /admin/unlock (owner decision, 2026-11-23).
// Done clears the request from the Unlock tile's dot on the admin landing; it changes nothing about the
// member's access or their submission. Admin-gated, CSRF-guarded, and audited.
export async function POST(request: Request) {
  const csrfDeny = ensureUnlockMutationCsrf(request);
  if (csrfDeny) return csrfDeny;
  const gate = await requireUnlockAdminAccess();
  if (!gate.allowed) return gate.response;
  const requestId = resolveUnlockRequestId(request);

  const raw = (await request.json().catch(() => null)) as DoneBody | null;
  if (!raw) return unlockErrorResponse('Invalid JSON payload.', 400);
  const parsed = parseDoneBody(raw);
  if (!parsed.ok) return unlockErrorResponse(parsed.message, 400);
  const { userId, done } = parsed;

  try {
    const found = await setUnlockHelpRequestDone(userId, done);
    if (!found) return unlockErrorResponse('This member has not asked for help, so there is no request to mark.', 404);
    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.help-request.done',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: userId,
      requestId,
      metadata: { done },
    });
    return NextResponse.json({ ok: true, userId, done });
  } catch (error) {
    return failureResponse({
      summary: 'The help request could not be marked',
      error,
      code: 'unlock_help_request_update_failed',
      area: 'unlock',
      op: 'admin_help_request_done',
      extra: { done },
    });
  }
}
