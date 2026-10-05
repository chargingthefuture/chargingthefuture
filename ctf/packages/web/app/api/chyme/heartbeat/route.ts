import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { ChymeRemovedError, ChymeRoomFullError, touchRoomPresence } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { requireChymeRoomAccess, ensureMutationCsrf } from '../_lib';

// Presence heartbeat: the audio room pings this on an interval while a member is in the call so
// their last_seen_at stays fresh and they keep counting as present. No audit log — it is a
// high-frequency keepalive, not a state-changing command. A beat that would put a member who has
// dropped out of the count back into a room at its cap answers 409 CHYME_ROOM_FULL, the same
// answer the join gives; the apps then stop beating and show the message in place of the stage.
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
    await touchRoomPresence(gate.identity, gate.roomKey);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ChymeRemovedError) {
      return NextResponse.json({ ok: false, code: CHYME_ERROR_CODE.removedFromRoom, message: error.message }, { status: 403 });
    }
    if (error instanceof ChymeRoomFullError) {
      return NextResponse.json(
        { ok: false, code: CHYME_ERROR_CODE.roomFull, message: error.message, capacity: error.capacity },
        { status: 409 },
      );
    }
    reportError(error, { area: 'chyme', op: 'call_heartbeat', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to refresh Chyme presence.' },
      { status: 500 },
    );
  }
}
