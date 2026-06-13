import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE } from 'lib/chyme/constants';
import { touchRoomPresence } from 'lib/chyme/repository';
import { reportError } from 'lib/observability/report';
import { requireChymeAccess } from '../_lib';

// Presence heartbeat: the audio room pings this on an interval while a member is in the call so
// their last_seen_at stays fresh and they keep counting as present. No audit log — it is a
// high-frequency keepalive, not a state-changing command.
export async function POST() {
  const gate = await requireChymeAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    await touchRoomPresence(gate.identity);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'chyme', op: 'call_heartbeat', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: CHYME_ERROR_CODE.internalError, message: 'Unable to refresh Chyme presence.' },
      { status: 500 },
    );
  }
}
