import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { heartbeatBackChannel } from 'lib/chyme/back-channel';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess, ensureMutationCsrf } from '../../_lib';
import { backChannelErrorResponse, readJsonField } from '../_shared';

// POST /api/chyme/back-channel/heartbeat  { callId }
// Keeps a live call from being reaped. Called on an interval by both apps while the call is open.
// Not audited (high-frequency, low-signal) — mirrors the room heartbeat.
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
    await heartbeatBackChannel(gate.identity.userId, callId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const mapped = backChannelErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    reportError(error, { area: 'chyme', op: 'back_channel_heartbeat', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to keep Back Channel alive.' },
      { status: 500 },
    );
  }
}
