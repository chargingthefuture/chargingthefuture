import { NextResponse } from 'next/server';
import { ensureUnlockMutationCsrf, requireUnlockAdminAccess, resolveUnlockRequestId, unlockErrorResponse } from 'lib/unlock/_lib';
import { addUnlockBannedAccount, removeUnlockBannedAccount } from 'lib/unlock/banned-accounts';
import { banAccountWithProvider, unbanAccountWithProvider, type ProviderBanOutcome } from 'lib/unlock/provider-ban';
import { insertUnlockAudit } from 'lib/unlock/repository';
import { failureResponse } from 'lib/errors/failure';

const MAX_NOTE_LENGTH = 200;

type BanBody = {
  userId?: string;
  banned?: boolean;
  note?: string;
};

type ParsedBody = { userId: string; banned: boolean; note: string | null };

// Read and validate the request body. Keeps the branching out of POST so it stays inside the rule-116
// complexity gate.
function parseBanBody(raw: BanBody): { ok: true; body: ParsedBody } | { ok: false; message: string } {
  const userId = raw.userId?.trim();
  if (!userId) {
    return { ok: false, message: 'userId is required.' };
  }
  if (typeof raw.banned !== 'boolean') {
    return { ok: false, message: 'banned must be true (ban the account) or false (lift the ban).' };
  }
  const note = raw.note?.trim();
  if (note && note.length > MAX_NOTE_LENGTH) {
    return { ok: false, message: `note must be ${MAX_NOTE_LENGTH} characters or fewer.` };
  }
  return { ok: true, body: { userId, banned: raw.banned, note: note && note.length > 0 ? note : null } };
}

// Ban or unban at the provider and record the result, so POST stays inside the rule-116 complexity
// limit. The row is written whatever the provider said: a ban an admin believes in but that never
// reached the provider is worse than one shown as still needing a press, so the refusal is kept on
// the row rather than dropped.
async function applyBan(input: {
  userId: string;
  banned: boolean;
  note: string | null;
  actorUserId: string;
}): Promise<ProviderBanOutcome> {
  const outcome = input.banned
    ? await banAccountWithProvider(input.userId)
    : await unbanAccountWithProvider(input.userId);

  if (!input.banned) {
    await removeUnlockBannedAccount(input.userId);
    return outcome;
  }

  await addUnlockBannedAccount({
    userId: input.userId,
    reason: 'perp',
    note: banNote(input.note, outcome),
    actorUserId: input.actorUserId,
  });
  return outcome;
}

// The note stored on the row: what the admin typed, the provider's refusal, both, or neither.
function banNote(note: string | null, outcome: ProviderBanOutcome): string | null {
  if (outcome.ok) return note;
  return note ? `${note} — ${outcome.reason}` : outcome.reason;
}

// Admin action: ban an account straight from the sign-up list, or lift that ban.
//
// This is the only route to a ban for somebody who never submitted a Quora URL. The Spam and Duplicate
// buttons hang off a submission row, so an account that signed up and stopped had nothing to act on —
// it showed on the admin page with no button beside it, which is why those accounts accumulated.
//
// The ban is two writes and both matter. The row is what the admin page reads and what keeps the ban
// countable; the provider ban is what actually stops a sign-in, here and on anything else the same
// provider fronts. A provider failure does not fail the request — the row is still written, carrying
// the reason the ban did not take, so the admin page can show that it needs another press rather than
// reporting a ban that never happened.
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

  let raw: BanBody;
  try {
    raw = (await request.json()) as BanBody;
  } catch {
    return unlockErrorResponse('Invalid JSON payload.', 400);
  }

  const parsed = parseBanBody(raw);
  if (!parsed.ok) {
    return unlockErrorResponse(parsed.message, 400);
  }
  const { userId, banned, note } = parsed.body;

  if (userId === gate.auth.userId) {
    return unlockErrorResponse('You cannot ban your own account.', 400);
  }

  try {
    const outcome = await applyBan({ userId, banned, note, actorUserId: gate.auth.userId });

    await insertUnlockAudit({
      actorUserId: gate.auth.userId,
      command: 'unlock.admin.signups.ban',
      policyStatus: 'allow',
      reason: outcome.ok ? 'ok' : 'provider_ban_failed',
      targetUserId: userId,
      requestId,
      metadata: { banned, providerOk: outcome.ok, hasNote: note !== null },
    });

    return NextResponse.json({
      ok: true,
      userId,
      banned,
      providerOk: outcome.ok,
      providerReason: outcome.ok ? null : outcome.reason,
    });
  } catch (error) {
    return failureResponse({
      summary: 'The account ban could not be recorded',
      error,
      code: 'unlock_banned_accounts_update_failed',
      area: 'unlock',
      op: 'admin_banned_accounts_update',
      extra: { banned },
    });
  }
}
