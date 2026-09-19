import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { createStreamJoinCredentials } from 'lib/chyme/stream';
import { ChymeRemovedError, ChymeRoomFullError, chymeHandle, getRoomState, markRoomCallJoined } from 'lib/chyme/repository';
import { logChymeAudit } from 'lib/chyme/audit';
import { reportError } from 'lib/observability/report';
import { streamFailureMessage } from 'lib/shared/stream-error-text';
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
    const room = await getRoomState(gate.identity, gate.roomKey, gate.auth.isAdmin);

    // The cap in force (it moves with the Stream quota band). Checked before the Stream mint so a
    // turned-away member costs no Stream call, and again under a lock inside markRoomCallJoined so
    // two members racing for the last spot cannot both take it. A member already counted as present
    // (rejoining after a dropped connection) is never turned away by their own row.
    const alreadyIn = room.participants.some((participant) => participant.userId === gate.auth.userId);
    if (!alreadyIn && room.capacity.current >= room.capacity.max) {
      return roomFullResponse(gate.auth.userId, room.roomId, room.roomKey, room.capacity);
    }

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

    const activeRoom = await markRoomCallJoined(gate.identity, gate.roomKey, gate.auth.isAdmin);

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
    if (error instanceof ChymeRoomFullError) {
      return roomFullResponse(gate.auth.userId, null, gate.roomKey, error.capacity);
    }
    if (error instanceof ChymeRemovedError) {
      logChymeAudit({
        pluginId: 'chyme',
        command: 'chyme.call.join',
        actorId: gate.auth.userId,
        status: 'deny',
        reason: 'removed_from_room',
        target: { roomKey: gate.roomKey },
        result: 'failure',
        errorCategory: 'forbidden',
      });
      return NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.removedFromRoom, message: error.message }, { status: 403 });
    }
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
        message: streamFailureMessage('Unable to join Chyme call', error),
      },
      { status: 500 },
    );
  }
}

// 409 with the cap so the client can say "N of N" and offer a retry. Audited as a deny: a full room
// is a state the owner wants to see in the trail, not a fault.
function roomFullResponse(
  actorId: string,
  roomId: string | null,
  roomKey: string,
  capacity: { current: number; max: number },
) {
  logChymeAudit({
    pluginId: 'chyme',
    command: 'chyme.call.join',
    actorId,
    status: 'deny',
    reason: 'room_full',
    target: { roomId, roomKey, capacity: `${capacity.current}/${capacity.max}` },
    result: 'failure',
    errorCategory: 'capacity',
  });
  return NextResponse.json(
    {
      ok: false,
      code: CHYME_ERROR_CODE.roomFull,
      message: `This room is full right now (${capacity.max} of ${capacity.max} people). Try again in a minute.`,
      capacity,
    },
    { status: 409 },
  );
}
