import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { addUnlockExcludedAccount, removeUnlockExcludedAccount } from 'lib/unlock/excluded-accounts';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { failureResponse } from 'lib/errors/failure';

const MAX_NOTE_LENGTH = 200;

type ExcludeBody = {
  userId?: string;
  excluded?: boolean;
  note?: string;
};

type ParsedBody = { userId: string; excluded: boolean; note: string | null };

// Read and validate the request body. Keeps the branching out of POST so it stays inside the rule-116
// complexity gate.
function parseExcludeBody(raw: ExcludeBody): { ok: true; body: ParsedBody } | { ok: false; message: string } {
  const userId = raw.userId?.trim();
  if (!userId) {
    return { ok: false, message: 'userId is required.' };
  }
  if (typeof raw.excluded !== 'boolean') {
    return { ok: false, message: 'excluded must be true (mark as demo/test) or false (put back in the counts).' };
  }
  const note = raw.note?.trim();
  if (note && note.length > MAX_NOTE_LENGTH) {
    return { ok: false, message: `note must be ${MAX_NOTE_LENGTH} characters or fewer.` };
  }
  return { ok: true, body: { userId, excluded: raw.excluded, note: note && note.length > 0 ? note : null } };
}

// Admin action: mark an account as a demo/test account (or put it back). This only changes the sign-up
// counters on the Unlock admin page — it does not touch the member's access, their submission, or any
// reward. Admin-gated, CSRF-guarded, and audited.
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

  let raw: ExcludeBody;
  try {
    raw = (await request.json()) as ExcludeBody;
  } catch {
    return unlockErrorResponse('Invalid JSON payload.', 400);
  }

  const parsed = parseExcludeBody(raw);
  if (!parsed.ok) {
    return unlockErrorResponse(parsed.message, 400);
  }
  const { userId, excluded, note } = parsed.body;

  try {
    if (excluded) {
      await addUnlockExcludedAccount({ userId, note, actorUserId: gate.auth.userId });
    } else {
      await removeUnlockExcludedAccount(userId);
    }

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.signups.exclude',
      policyStatus: 'allow',
      reason: 'ok',
      targetUserId: userId,
      requestId,
      metadata: { excluded, hasNote: note !== null },
    });

    return NextResponse.json({ ok: true, userId, excluded });
  } catch (error) {
    return failureResponse({
      summary: 'The demo/test account list could not be updated',
      error,
      code: 'unlock_excluded_accounts_update_failed',
      area: 'unlock',
      op: 'admin_excluded_accounts_update',
      extra: { excluded },
    });
  }
}
