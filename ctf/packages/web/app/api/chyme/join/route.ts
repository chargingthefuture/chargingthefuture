import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { createStreamJoinCredentials } from 'lib/chyme/stream';
import { getRoomState, markRoomCallJoined } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess } from '../_lib';

export async function POST() {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const room = await getRoomState(gate.identity);
    const credentials = await createStreamJoinCredentials(gate.auth.userId, gate.identity.displayName);

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

    const activeRoom = await markRoomCallJoined(gate.identity);

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
