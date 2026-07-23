import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { logChymeAudit } from 'lib/chyme/audit';
import { getRoomState } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { requireChymeRoomAccess } from '../_lib';

export async function GET(request: Request) {
  const gate = await requireChymeRoomAccess(request);
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const room = await getRoomState(gate.identity, gate.roomKey);
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.room.state.fetch',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {
        roomId: room.roomId,
        roomKey: room.roomKey,
      },
      result: 'success',
      errorCategory: null,
    });

    return NextResponse.json(room, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'room_state_fetch', extra: { userId: gate.auth.userId } });
    logChymeAudit({
      pluginId: 'chyme',
      command: 'chyme.room.state.fetch',
      actorId: gate.auth.userId,
      status: 'allow',
      reason: 'approved_user_or_admin',
      target: {},
      result: 'failure',
      errorCategory: 'persistence_error',
    });

    return NextResponse.json(
      {
        ok: false,
        code: CHYME_ERROR_CODE.persistenceUnavailable,
        message: 'Unable to load Chyme room state.',
      },
      { status: 503 },
    );
  }
}
