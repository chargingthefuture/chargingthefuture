import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { inviteBackChannel } from 'lib/chyme/back-channel';
import { logChymeAudit } from 'lib/chyme/audit';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess, ensureMutationCsrf } from '../../_lib';
import { backChannelErrorResponse, readJsonField } from '../_shared';

// POST /api/chyme/back-channel/invite  { recipientUserId }
// Start a Back Channel with another member who is in the same live room right now. Consent-gated
// (they accept), block-aware (403 either direction), room-bound. No credits.
export async function POST(request: Request) {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const recipientUserId = await readJsonField(request, 'recipientUserId');
  if (!recipientUserId) {
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.invalidPayload, message: 'recipientUserId is required.' },
      { status: 400 },
    );
  }

  try {
    const { callId } = await inviteBackChannel(
      { userId: gate.identity.userId, username: gate.identity.username },
      recipientUserId,
    );
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.back-channel.invite',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: { callId, recipientUserId },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, callId }, { status: 200 });
  } catch (error) {
    const mapped = backChannelErrorResponse(error);
    if (mapped) {
      logChymeAudit({
        pluginId: 'chyme',
        command: 'chyme.back-channel.invite',
        actorId: gate.auth.userId,
        status: 'deny',
        reason: 'back_channel_rejected',
        target: { recipientUserId },
        result: 'failure',
        errorCategory: 'validation_error',
      });
      return mapped;
    }
    reportError(error, { area: 'chyme', op: 'back_channel_invite', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to start Back Channel.' },
      { status: 500 },
    );
  }
}
