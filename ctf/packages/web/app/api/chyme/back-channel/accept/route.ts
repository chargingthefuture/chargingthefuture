import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { acceptBackChannel } from 'lib/chyme/back-channel';
import { createChymeBackChannelCredentials } from 'lib/chyme/stream';
import { chymeHandle } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess, ensureMutationCsrf } from '../../_lib';
import { backChannelErrorResponse, readJsonField } from '../_shared';

// POST /api/chyme/back-channel/accept  { callId }
// The recipient accepts an invite; the call goes live and this returns the recipient's join creds.
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
    const row = await acceptBackChannel(gate.identity.userId, callId);
    const credentials = await createChymeBackChannelCredentials({
      userId: gate.identity.userId,
      name: chymeHandle(gate.identity.username, gate.identity.userId),
      callId: row.id,
    });
    if (!credentials) {
      logChymeAudit({
        pluginId: 'chyme',
        command: 'chyme.back-channel.accept',
        actorId: gate.auth.userId,
        status: 'allow',
        reason: 'stream_not_configured',
        target: { callId: row.id },
        result: 'failure',
        errorCategory: 'service_unavailable',
      });
      return NextResponse.json(
        { ok: false, code: CHYME_ERROR_CODE.streamUnavailable, message: 'Stream service is not configured.' },
        { status: 503 },
      );
    }

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.back-channel.accept',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: { callId: row.id, streamCallId: credentials.streamCallId },
      result: 'success',
      errorCategory: null,
    });
    return NextResponse.json({ ok: true, callId: row.id, ...credentials }, { status: 200 });
  } catch (error) {
    const mapped = backChannelErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'chyme', op: 'back_channel_accept', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to accept Back Channel.' },
      { status: 500 },
    );
  }
}
