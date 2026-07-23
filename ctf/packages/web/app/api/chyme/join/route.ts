import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { createStreamJoinCredentials } from 'lib/chyme/stream';
import { chymeHandle, getRoomState, markRoomCallJoined } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { reportError } from 'lib/observability/report';
import { requireChymeRoomAccess, ensureMutationCsrf } from '../_lib';

export async function POST(request: Request) {
  const gate = await requireChymeRoomAccess(request);
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  try {
    const room = await getRoomState(gate.identity, gate.roomKey);
    const credentials = await createStreamJoinCredentials(
      gate.auth.userId,
      chymeHandle(gate.identity.username, gate.identity.userId),
      // The Stream chat channel id equals the room key, so the private room's chat is its own channel.
      gate.roomKey,
    );

    if (!credentials) {
      logChymeAudit({
        pluginId: 'chyme',
        command: 'chyme.call.join',
        actorId: gate.auth.userId,
        status: 'deny',
        reason: 'stream_not_configured',
        target: {
          roomId: room.roomId,
          roomKey: room.roomKey,
        },
        result: 'failure',
        errorCategory: 'service_unavailable',
      });

      return NextResponse.json(
        {
          ok: false,
          code: CHYME_ERROR_CODE.streamUnavailable,
          message: 'Stream service is not configured.',
        },
        { status: 503 },
      );
    }

    const activeRoom = await markRoomCallJoined(gate.identity, gate.roomKey);

    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.call.join',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {
        roomId: activeRoom.roomId,
        roomKey: activeRoom.roomKey,
        streamChannelId: credentials.streamChannelId,
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(
      {
        ok: true,
        roomId: activeRoom.roomId,
        roomKey: activeRoom.roomKey,
        ...credentials,
      },
      { status: 200 },
    );
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'call_join', extra: { userId: gate.auth.userId } });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.call.join',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {},
      result: 'failure',
      errorCategory: 'internal_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.internalError,
        message: 'Unable to join Chyme call.',
      },
      { status: 500 },
    );
  }
}
