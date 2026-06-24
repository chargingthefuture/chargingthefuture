import { NextResponse } from 'next/server';
import { requireAccountAccess, ensureMutationCsrf } from '../../_lib';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { unblockUser } from 'lib/blocks/repository';
import { reportError } from 'lib/observability/report';

// Remove a block (unblock). Same baseline auth as the rest of the blocks API — any signed-in member,
// never unlock-gated. CSRF-protected and idempotent: unblocking someone who is not blocked still
// returns ok, so the manage-list never errors on a double-unblock or a stale row.
//
// DELETE /api/account/blocks/:blockedUserId
export async function DELETE(request: Request, context: { params: Promise<{ blockedUserId: string }> }) {
  const gate = await requireAccountAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const { blockedUserId } = await context.params;
  const target = blockedUserId.trim();
  if (target.length === 0) {
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.invalidPayload, message: 'blockedUserId is required.' },
      { status: 400 },
    );
  }

  try {
    await unblockUser(gate.auth.userId, target);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'account', op: 'blocks_remove' });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to unblock this member.' },
      { status: 503 },
    );
  }
}
