import { NextResponse } from 'next/server';
import { removeMute } from 'lib/mutes/repository';
import { ACCOUNT_ERROR_CODE } from 'lib/account/constants';
import { failureReason } from 'lib/errors/failure';
import { reportError } from 'lib/observability/report';
import { ensureMutationCsrf, requireAccountAccess } from '../../_lib';

// DELETE /api/account/mutes/[muteId]: unmute. Only the member's own mute; idempotent.
export async function DELETE(request: Request, context: { params: Promise<{ muteId: string }> }) {
  const csrf = ensureMutationCsrf(request);
  if (csrf) return csrf;
  const gate = await requireAccountAccess();
  if (!gate.allowed) return gate.response;
  const { muteId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(muteId)) {
    return NextResponse.json({ ok: false, code: ACCOUNT_ERROR_CODE.invalidPayload, message: 'That is not a mute id.' }, { status: 400 });
  }
  try {
    await removeMute(gate.auth.userId, muteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    reportError(error, { area: 'account', op: 'mutes_remove' });
    return NextResponse.json(
      { ok: false, code: ACCOUNT_ERROR_CODE.persistenceUnavailable, message: `Unable to unmute: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
