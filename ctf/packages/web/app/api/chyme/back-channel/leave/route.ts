import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { leaveBackChannel } from 'lib/chyme/back-channel';
import { logChymeAudit } from 'lib/chyme/audit';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess, ensureMutationCsrf } from '../../_lib';
import { backChannelErrorResponse, readJsonField } from '../_shared';

// POST /api/chyme/back-channel/leave  { callId }
// Either party hangs up (or the initiator cancels a still-pending invite). Terminal.
export async function POST(request: Request) {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  const callId = await readJsonField(request, 'callId');
  if (!callId) {
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.invalidPayload, message: 'callId is required.' },
      { status: 400 },
    );
  }

  try {
    await leaveBackChannel(gate.identity.userId, callId);
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.back-channel.leave',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: { callId },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const mapped = backChannelErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'chyme', op: 'back_channel_leave', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to leave Back Channel.' },
      { status: 500 },
    );
  }
}
