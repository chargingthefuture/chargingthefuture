import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { logChymeAudit } from 'lib/chyme/audit';
import { setRoomMemberHandRaised } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { requireChymeRoomAccess, ensureMutationCsrf } from '../_lib';
import { failureReason } from 'lib/errors/failure';

// Persist the caller's raise/lower hand on their presence row so everyone in the room keeps seeing
// the raised hand until they lower it (or leave). Stream reactions are transient and auto-clear, so
// they cannot carry this state; this stores it server-side and returns the refreshed room.
type HandRequestBody = {
  raised?: unknown;
};

export async function POST(request: Request) {
  const gate = await requireChymeRoomAccess(request);
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: HandRequestBody;
  try {
    body = (await request.json()) as HandRequestBody;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.invalidPayload,
        message: 'Invalid JSON payload.', reason: failureReason(error),
      },
      { status: 400 },
    );
  }

  if (typeof body.raised !== 'boolean') {
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.hand',
      actorId: gate.auth.userId,
      status: 'deny',
      reason: 'invalid_raised_flag',
      target: { roomKey: gate.roomKey },
      result: 'failure',
      errorCategory: 'validation',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.invalidPayload,
        message: 'Field "raised" must be a boolean.',
      },
      { status: 400 },
    );
  }

  try {
    const room = await setRoomMemberHandRaised(gate.identity, body.raised, gate.roomKey);

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.hand',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: { roomId: room.roomId, roomKey: room.roomKey },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json({ ok: true, room }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'hand_toggle', extra: { userId: gate.auth.userId } });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.hand',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: { roomKey: gate.roomKey },
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to update raised hand.' },
      { status: 500 },
    );
  }
}
